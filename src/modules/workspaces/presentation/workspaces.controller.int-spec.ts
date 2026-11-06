import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { inject } from 'vitest';

import { MAIL_TRANSPORT, type MailMessage } from '@common/mail';
import { AdminId } from '@modules/admins';

import { configureApp } from '../../../configure-app.js';
import { SystemRoleId } from '../domain/value-objects/system-workspace-role.js';
import { restoreSystemRoles } from '../testing/system-roles.js';

const ADMIN_ID = AdminId.generate();
const OWNER_ROLE = SystemRoleId.OWNER;
const ADMIN_ROLE = SystemRoleId.ADMIN;
const MEMBER_ROLE = SystemRoleId.MEMBER;

type TokenBody = {
  accessToken: string;
};

type MemberBody = { userId: string; name: string; email: string; roleId: string; role: string };

type WorkspaceBody = {
  id: string;
  name: string;
  roleId: string;
  role: string;
  memberCount: number;
  members: MemberBody[];
};

type MembersPageBody = {
  items: MemberBody[];
  page: number;
  limit: number;
  total: number;
};

describe('WorkspacesController', () => {
  const pool = new Pool({ connectionString: inject('databaseUrl') });
  const mails: MailMessage[] = [];
  let app: NestFastifyApplication;

  const lastCode = (): string => /code(?: is|:) (\d{6})/.exec(mails.at(-1)?.text ?? '')?.[1] ?? '';

  const call = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    token?: string,
    body?: object,
  ) => {
    const pending = request(app.getHttpServer())[method](path);
    if (token) {
      void pending.set('authorization', `Bearer ${token}`);
    }
    return body ? pending.send(body) : pending;
  };

  const login = async (email: string): Promise<string> => {
    await call('post', '/v1/auth/user/otp', undefined, { email }).expect(202);
    const response = await call('post', '/v1/auth/user/token', undefined, {
      email,
      otp: lastCode(),
    }).expect(200);
    return (response.body as TokenBody).accessToken;
  };

  const loginAdmin = async (): Promise<string> => {
    await call('post', '/v1/auth/admin/otp', undefined, { email: 'root@b.co' }).expect(202);
    const response = await call('post', '/v1/auth/admin/token', undefined, {
      email: 'root@b.co',
      otp: lastCode(),
    }).expect(200);
    return (response.body as TokenBody).accessToken;
  };

  const registerTenant = async (
    email: string,
  ): Promise<{ workspaceId: string; userId: string }> => {
    const adminToken = await loginAdmin();
    await call('post', '/v1/invitations', adminToken, { email }).expect(201);
    const invitationId = /Invitation ID: (\S+)/.exec(mails.at(-1)?.text ?? '')?.[1];
    const response = await call('post', `/v1/invitations/${invitationId}/accept`, undefined, {
      otp: lastCode(),
      tenantName: 'Acme',
      userName: 'Owner',
    }).expect(201);
    return response.body as { workspaceId: string; userId: string };
  };

  const addMember = async (
    workspaceId: string,
    token: string,
    email: string,
    roleId: string = ADMIN_ROLE,
  ): Promise<string> => {
    const response = await call('post', `/v1/workspaces/${workspaceId}/members`, token, {
      email,
      name: email.split('@')[0],
      roleId,
    }).expect(201);
    return (response.body as { userId: string }).userId;
  };

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', inject('databaseUrl'));
    vi.stubEnv('OTP_SECRET', 'x'.repeat(32));
    vi.stubEnv('JWT_SECRET', 'y'.repeat(32));
    const { AppModule } = await import('../../../app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_TRANSPORT)
      .useValue({
        send: (message: MailMessage) => {
          mails.push(message);
          return Promise.resolve();
        },
      })
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app, { docs: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    mails.length = 0;
    await pool.query(
      'TRUNCATE TABLE rate_limits, refresh_tokens, login_challenges, invitations, workspace_members, workspaces, users, tenants, admins CASCADE',
    );
    await restoreSystemRoles(pool);
    await pool.query("INSERT INTO admins (id, email) VALUES ($1, 'root@b.co')", [ADMIN_ID]);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    vi.unstubAllEnvs();
  });

  it('creates the workspace with the first user as owner when an invitation is accepted', async () => {
    const { workspaceId, userId } = await registerTenant('owner@acme.co');
    const token = await login('owner@acme.co');

    const response = await call('get', `/v1/workspaces/${workspaceId}`, token).expect(200);

    expect(response.body as WorkspaceBody).toEqual({
      id: workspaceId,
      name: 'Acme',
      roleId: OWNER_ROLE,
      role: 'owner',
      memberCount: 1,
      members: [
        { userId, name: 'Owner', email: 'owner@acme.co', roleId: OWNER_ROLE, role: 'owner' },
      ],
    });
  });

  it('lets an owner add a member, who can then log in, and another owner', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');

    const added = await addMember(workspaceId, ownerToken, 'dev@acme.co');
    const second = await addMember(workspaceId, ownerToken, 'boss@acme.co', OWNER_ROLE);

    const memberToken = await login('dev@acme.co');
    const view = (await call('get', `/v1/workspaces/${workspaceId}`, memberToken).expect(200))
      .body as WorkspaceBody;
    expect(view.role).toBe('admin');
    expect(view.memberCount).toBe(3);
    expect(view.members).toHaveLength(3);
    expect(added).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers 403 naming the missing permission and 401 without a token', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    await addMember(workspaceId, ownerToken, 'dev@acme.co', MEMBER_ROLE);
    const memberToken = await login('dev@acme.co');

    const forbidden = await call('post', `/v1/workspaces/${workspaceId}/members`, memberToken, {
      email: 'x@acme.co',
      name: 'X',
      roleId: MEMBER_ROLE,
    }).expect(403);
    await call('get', `/v1/workspaces/${workspaceId}`).expect(401);

    expect(forbidden.body).toEqual({
      error: { code: 'WORKSPACE_PERMISSION_DENIED', missing: ['workspace-member:add'] },
      requestId: expect.any(String),
    });
  });

  it('lets an admin manage non-owners but keeps owners to owners', async () => {
    const { workspaceId, userId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    await addMember(workspaceId, ownerToken, 'admin@acme.co');
    const adminToken = await login('admin@acme.co');
    const members = `/v1/workspaces/${workspaceId}/members`;

    const memberId = await addMember(workspaceId, adminToken, 'dev@acme.co', MEMBER_ROLE);
    await call('patch', `${members}/${memberId}`, adminToken, { roleId: ADMIN_ROLE }).expect(204);
    await call('delete', `${members}/${memberId}`, adminToken).expect(204);

    const denied = await call('delete', `${members}/${userId}`, adminToken).expect(403);
    expect((denied.body as { error: { code: string } }).error.code).toBe(
      'WORKSPACE_OWNER_REQUIRED',
    );
  });

  it('manages custom roles and applies them to the members who hold them', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const roles = `/v1/workspaces/${workspaceId}/roles`;

    const created = await call('post', roles, ownerToken, {
      key: 'recruiter',
      name: 'Recruiter',
      permissions: ['workspace-member:add'],
    }).expect(201);
    const roleId = (created.body as { id: string }).id;
    const recruiterId = await addMember(workspaceId, ownerToken, 'r@acme.co', roleId);
    const recruiterToken = await login('r@acme.co');
    await addMember(workspaceId, recruiterToken, 'dev@acme.co', MEMBER_ROLE);

    const listed = await call('get', roles, recruiterToken).expect(200);
    expect(listed.body).toContainEqual({
      id: roleId,
      key: 'recruiter',
      name: 'Recruiter',
      system: false,
      permissions: ['workspace-member:add'],
    });

    const view = (await call('get', `/v1/workspaces/${workspaceId}`, recruiterToken).expect(200))
      .body as WorkspaceBody;
    expect(view).toMatchObject({ roleId, role: 'recruiter' });

    await call('patch', `${roles}/${roleId}`, ownerToken, {
      name: 'Viewer',
      permissions: [],
    }).expect(204);
    await call('post', `/v1/workspaces/${workspaceId}/members`, recruiterToken, {
      email: 'x@acme.co',
      name: 'X',
      roleId: MEMBER_ROLE,
    }).expect(403);

    const inUse = await call('delete', `${roles}/${roleId}`, ownerToken).expect(409);
    expect((inUse.body as { error: { code: string } }).error.code).toBe('WORKSPACE_ROLE_IN_USE');
    await call('patch', `/v1/workspaces/${workspaceId}/members/${recruiterId}`, ownerToken, {
      roleId: MEMBER_ROLE,
    }).expect(204);
    await call('delete', `${roles}/${roleId}`, ownerToken).expect(204);
  });

  it('shares system roles between workspaces and never changes them', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const roles = `/v1/workspaces/${workspaceId}/roles`;

    const listed = await call('get', roles, ownerToken).expect(200);
    const updated = await call('patch', `${roles}/${ADMIN_ROLE}`, ownerToken, {
      name: 'Boss',
      permissions: [],
    }).expect(409);
    const deleted = await call('delete', `${roles}/${MEMBER_ROLE}`, ownerToken).expect(409);

    expect((listed.body as { key: string }[]).map((role) => role.key)).toEqual([
      'admin',
      'member',
      'owner',
    ]);
    expect((updated.body as { error: { code: string } }).error.code).toBe('WORKSPACE_ROLE_SYSTEM');
    expect((deleted.body as { error: { code: string } }).error.code).toBe('WORKSPACE_ROLE_SYSTEM');
  });

  it('refuses a custom role of another workspace', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const other = await registerTenant('other@beta.co');
    const otherToken = await login('other@beta.co');
    const created = await call('post', `/v1/workspaces/${other.workspaceId}/roles`, otherToken, {
      key: 'beta-only',
      name: 'Beta',
      permissions: [],
    }).expect(201);
    const roleId = (created.body as { id: string }).id;

    await call('get', `/v1/workspaces/${other.workspaceId}/roles`, ownerToken).expect(404);
    await call('patch', `/v1/workspaces/${workspaceId}/roles/${roleId}`, ownerToken, {
      name: 'Stolen',
      permissions: [],
    }).expect(404);
    const response = await call('post', `/v1/workspaces/${workspaceId}/members`, ownerToken, {
      email: 'x@acme.co',
      name: 'X',
      roleId,
    }).expect(404);

    expect((response.body as { error: { code: string } }).error.code).toBe(
      'WORKSPACE_ROLE_NOT_FOUND',
    );
  });

  it('keeps one owner: the last owner cannot leave or be demoted, others can', async () => {
    const { workspaceId, userId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const devId = await addMember(workspaceId, ownerToken, 'dev@acme.co');
    const members = `/v1/workspaces/${workspaceId}/members`;

    const leave = await call('post', `/v1/workspaces/${workspaceId}/leave`, ownerToken).expect(409);
    const demote = await call('patch', `${members}/${userId}`, ownerToken, {
      roleId: ADMIN_ROLE,
    }).expect(409);
    await call('patch', `${members}/${devId}`, ownerToken, { roleId: OWNER_ROLE }).expect(204);
    await call('post', `/v1/workspaces/${workspaceId}/leave`, ownerToken).expect(204);

    expect(leave.body).toEqual({
      error: { code: 'WORKSPACE_LAST_OWNER_REQUIRED' },
      requestId: expect.any(String),
    });
    expect(demote.body).toEqual({
      error: { code: 'WORKSPACE_LAST_OWNER_REQUIRED' },
      requestId: expect.any(String),
    });
    const devToken = await login('dev@acme.co');
    const view = (await call('get', `/v1/workspaces/${workspaceId}`, devToken).expect(200))
      .body as WorkspaceBody;
    expect(view.members).toEqual([
      { userId: devId, name: 'dev', email: 'dev@acme.co', roleId: OWNER_ROLE, role: 'owner' },
    ]);
  });

  it('lets an owner remove a member', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const devId = await addMember(workspaceId, ownerToken, 'dev@acme.co');

    await call('delete', `/v1/workspaces/${workspaceId}/members/${devId}`, ownerToken).expect(204);

    const view = (await call('get', `/v1/workspaces/${workspaceId}`, ownerToken).expect(200))
      .body as WorkspaceBody;
    expect(view.members).toHaveLength(1);

    await call('post', '/v1/auth/user/otp', undefined, { email: 'dev@acme.co' }).expect(202);
    await call('post', '/v1/auth/user/token', undefined, {
      email: 'dev@acme.co',
      otp: lastCode(),
    }).expect(401);
  });

  it('lets an owner add a removed email again as a new user, whose old token stays dead', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const firstId = await addMember(workspaceId, ownerToken, 'dev@acme.co');
    const oldToken = await login('dev@acme.co');
    await call('delete', `/v1/workspaces/${workspaceId}/members/${firstId}`, ownerToken).expect(
      204,
    );

    const secondId = await addMember(workspaceId, ownerToken, 'dev@acme.co');

    expect(secondId).not.toBe(firstId);
    await call('get', `/v1/workspaces/${workspaceId}`, oldToken).expect(404);
    const newToken = await login('dev@acme.co');
    await call('get', `/v1/workspaces/${workspaceId}`, newToken).expect(200);
  });

  it('cannot see, change or remove a user of another tenant', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const { userId: otherUserId } = await registerTenant('owner@beta.co');
    const ownerToken = await login('owner@acme.co');
    const path = `/v1/workspaces/${workspaceId}/members/${otherUserId}`;

    const changed = await call('patch', path, ownerToken, { roleId: ADMIN_ROLE }).expect(404);
    const removed = await call('delete', path, ownerToken).expect(404);

    const notFound = {
      error: { code: 'WORKSPACE_MEMBER_NOT_FOUND' },
      requestId: expect.any(String),
    };
    expect(changed.body).toEqual(notFound);
    expect(removed.body).toEqual(notFound);
    const { rows } = await pool.query('SELECT 1 FROM users WHERE id = $1', [otherUserId]);
    expect(rows).toHaveLength(1);
  });

  it('answers 404 for every route on a workspace of another tenant or an unknown one', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const { workspaceId: otherWorkspaceId, userId: otherUserId } =
      await registerTenant('owner@beta.co');
    const ownerToken = await login('owner@acme.co');
    const body = { email: 'x@acme.co', name: 'X', roleId: ADMIN_ROLE };
    const unknownId = '0197b3a0-0000-7000-8000-000000000000';

    for (const target of [otherWorkspaceId, unknownId]) {
      const base = `/v1/workspaces/${target}`;
      const responses = await Promise.all([
        call('get', base, ownerToken),
        call('get', `${base}/members`, ownerToken),
        call('post', `${base}/members`, ownerToken, body),
        call('patch', `${base}/members/${workspaceId}`, ownerToken, { roleId: ADMIN_ROLE }),
        call('delete', `${base}/members/${otherUserId}`, ownerToken),
        call('post', `${base}/leave`, ownerToken),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          error: { code: 'WORKSPACE_NOT_FOUND' },
          requestId: expect.any(String),
        });
      }
    }
    const { rows } = await pool.query('SELECT 1 FROM users WHERE id = $1', [otherUserId]);
    expect(rows).toHaveLength(1);
  });

  it('answers 422 INPUT_INVALID naming the malformed path id', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');

    const badWorkspace = await call('get', '/v1/workspaces/nope', ownerToken);
    const badMember = await call(
      'delete',
      `/v1/workspaces/${workspaceId}/members/nope`,
      ownerToken,
    );

    expect(badWorkspace.status).toBe(422);
    expect(badWorkspace.body).toEqual({
      error: {
        code: 'INPUT_INVALID',
        fields: [{ path: 'workspaceId', code: 'invalid_format' }],
      },
      requestId: expect.any(String),
    });
    expect(badMember.status).toBe(422);
    expect(badMember.body).toEqual({
      error: {
        code: 'INPUT_INVALID',
        fields: [{ path: 'userId', code: 'invalid_format' }],
      },
      requestId: expect.any(String),
    });
  });

  it('keeps one owner when two owners demote each other at the same time', async () => {
    const { workspaceId, userId: firstId } = await registerTenant('owner@acme.co');
    const firstToken = await login('owner@acme.co');
    const secondId = await addMember(workspaceId, firstToken, 'boss@acme.co', OWNER_ROLE);
    const secondToken = await login('boss@acme.co');
    const members = `/v1/workspaces/${workspaceId}/members`;

    const statuses = (
      await Promise.all([
        call('patch', `${members}/${secondId}`, firstToken, { roleId: ADMIN_ROLE }),
        call('patch', `${members}/${firstId}`, secondToken, { roleId: ADMIN_ROLE }),
      ])
    )
      .map((response) => response.status)
      .sort((a, b) => a - b);

    expect(statuses).toEqual([204, 403]);
    const { rows } = await pool.query('SELECT 1 FROM workspace_members WHERE role_id = $1', [
      OWNER_ROLE,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('ends the access of a member who leaves', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    await addMember(workspaceId, ownerToken, 'dev@acme.co');
    const devToken = await login('dev@acme.co');

    await call('post', `/v1/workspaces/${workspaceId}/leave`, devToken).expect(204);

    await call('post', '/v1/auth/user/otp', undefined, { email: 'dev@acme.co' }).expect(202);
    await call('post', '/v1/auth/user/token', undefined, {
      email: 'dev@acme.co',
      otp: lastCode(),
    }).expect(401);
  });

  it('previews the 10 newest members and counts all of them', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const added: string[] = [];
    for (let index = 0; index < 11; index++) {
      added.push(await addMember(workspaceId, ownerToken, `m${index}@acme.co`));
    }

    const view = (await call('get', `/v1/workspaces/${workspaceId}`, ownerToken).expect(200))
      .body as WorkspaceBody;

    expect(view.memberCount).toBe(12);
    expect(view.members.map((member) => member.userId)).toEqual(added.slice(-10).reverse());
  });

  it('lists the members newest first, page by page', async () => {
    const { workspaceId, userId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const added: string[] = [];
    for (let index = 0; index < 4; index++) {
      added.push(await addMember(workspaceId, ownerToken, `m${index}@acme.co`));
    }
    const newestFirst = [...added.reverse(), userId];
    const page = async (query: string): Promise<MembersPageBody> =>
      (await call('get', `/v1/workspaces/${workspaceId}/members?${query}`, ownerToken).expect(200))
        .body as MembersPageBody;

    const first = await page('page=1&limit=2');
    const second = await page('page=2&limit=2');
    const last = await page('page=3&limit=2');
    const defaults = await page('');

    expect(first).toMatchObject({ page: 1, limit: 2, total: 5 });
    expect(first.items.map((member) => member.userId)).toEqual(newestFirst.slice(0, 2));
    expect(second.items.map((member) => member.userId)).toEqual(newestFirst.slice(2, 4));
    expect(last.items.map((member) => member.userId)).toEqual(newestFirst.slice(4));
    expect(defaults).toMatchObject({ page: 1, limit: 20, total: 5 });
    expect(defaults.items).toHaveLength(5);
  });

  it('answers INPUT_INVALID for a bad page or limit and 404 to a non-member', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const members = `/v1/workspaces/${workspaceId}/members`;

    for (const query of ['page=0', 'page=x', 'limit=0', 'limit=101', 'limit=1.5']) {
      const response = await call('get', `${members}?${query}`, ownerToken);
      expect(response.status).toBe(422);
      expect((response.body as { error: { code: string } }).error.code).toBe('INPUT_INVALID');
    }
    await call('get', `${members}?limit=100`, ownerToken).expect(200);
    await registerTenant('owner@beta.co');
    const outsiderToken = await login('owner@beta.co');
    await call('get', members, outsiderToken).expect(404);
  });

  it('keeps admins out and validates the body', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const adminToken = await loginAdmin();

    await call('get', `/v1/workspaces/${workspaceId}`, adminToken).expect(403);
    const invalid = await call('post', `/v1/workspaces/${workspaceId}/members`, ownerToken, {
      email: 'x@acme.co',
      name: 'X',
      roleId: 'admin',
    }).expect(422);
    await call('post', `/v1/workspaces/${workspaceId}/roles`, ownerToken, {
      key: 'x',
      name: 'X',
      permissions: ['not:real'],
    }).expect(422);

    expect((invalid.body as { error: { code: string } }).error.code).toBe('INPUT_INVALID');
  });
});
