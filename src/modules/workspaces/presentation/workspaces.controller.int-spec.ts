import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { inject } from 'vitest';

import { MAIL_TRANSPORT, type MailMessage } from '@common/mail';
import { AdminId } from '@modules/admins';

import { configureApp } from '../../../configure-app.js';

const ADMIN_ID = AdminId.create();

type TokenBody = {
  accessToken: string;
};

type MemberBody = { userId: string; name: string; email: string; role: string };

type WorkspaceBody = {
  id: string;
  name: string;
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
    role = 'admin',
  ): Promise<string> => {
    const response = await call('post', `/v1/workspaces/${workspaceId}/members`, token, {
      email,
      name: email.split('@')[0],
      role,
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
    await pool.query("INSERT INTO admins (id, email) VALUES ($1, 'root@b.co')", [ADMIN_ID.value]);
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
      role: 'owner',
      memberCount: 1,
      members: [{ userId, name: 'Owner', email: 'owner@acme.co', role: 'owner' }],
    });
  });

  it('lets an owner add a member, who can then log in, and another owner', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');

    const added = await addMember(workspaceId, ownerToken, 'dev@acme.co');
    const second = await addMember(workspaceId, ownerToken, 'boss@acme.co', 'owner');

    const memberToken = await login('dev@acme.co');
    const view = (await call('get', `/v1/workspaces/${workspaceId}`, memberToken).expect(200))
      .body as WorkspaceBody;
    expect(view.role).toBe('admin');
    expect(view.memberCount).toBe(3);
    expect(view.members).toHaveLength(3);
    expect(added).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers 403 to members who are not owners and 401 without a token', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    await addMember(workspaceId, ownerToken, 'dev@acme.co');
    const memberToken = await login('dev@acme.co');

    const forbidden = await call('post', `/v1/workspaces/${workspaceId}/members`, memberToken, {
      email: 'x@acme.co',
      name: 'X',
      role: 'admin',
    }).expect(403);
    await call('get', `/v1/workspaces/${workspaceId}`).expect(401);

    expect(forbidden.body).toEqual({ error: { code: 'WORKSPACE_OWNER_REQUIRED' } });
  });

  it('keeps one owner: the last owner cannot leave or be demoted, others can', async () => {
    const { workspaceId, userId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const devId = await addMember(workspaceId, ownerToken, 'dev@acme.co');
    const members = `/v1/workspaces/${workspaceId}/members`;

    const leave = await call('post', `/v1/workspaces/${workspaceId}/leave`, ownerToken).expect(409);
    const demote = await call('patch', `${members}/${userId}`, ownerToken, {
      role: 'admin',
    }).expect(409);
    await call('patch', `${members}/${devId}`, ownerToken, { role: 'owner' }).expect(204);
    await call('post', `/v1/workspaces/${workspaceId}/leave`, ownerToken).expect(204);

    expect(leave.body).toEqual({ error: { code: 'WORKSPACE_LAST_OWNER_REQUIRED' } });
    expect(demote.body).toEqual(leave.body);
    const devToken = await login('dev@acme.co');
    const view = (await call('get', `/v1/workspaces/${workspaceId}`, devToken).expect(200))
      .body as WorkspaceBody;
    expect(view.members).toEqual([
      { userId: devId, name: 'dev', email: 'dev@acme.co', role: 'owner' },
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

    const changed = await call('patch', path, ownerToken, { role: 'admin' }).expect(404);
    const removed = await call('delete', path, ownerToken).expect(404);

    expect(changed.body).toEqual({ error: { code: 'WORKSPACE_MEMBER_NOT_FOUND' } });
    expect(removed.body).toEqual({ error: { code: 'WORKSPACE_MEMBER_NOT_FOUND' } });
    const { rows } = await pool.query('SELECT 1 FROM users WHERE id = $1', [otherUserId]);
    expect(rows).toHaveLength(1);
  });

  it('answers 404 for every route on a workspace of another tenant or an unknown one', async () => {
    const { workspaceId } = await registerTenant('owner@acme.co');
    const { workspaceId: otherWorkspaceId, userId: otherUserId } =
      await registerTenant('owner@beta.co');
    const ownerToken = await login('owner@acme.co');
    const body = { email: 'x@acme.co', name: 'X', role: 'admin' };
    const unknownId = '0197b3a0-0000-7000-8000-000000000000';

    for (const target of [otherWorkspaceId, unknownId]) {
      const base = `/v1/workspaces/${target}`;
      const responses = await Promise.all([
        call('get', base, ownerToken),
        call('get', `${base}/members`, ownerToken),
        call('post', `${base}/members`, ownerToken, body),
        call('patch', `${base}/members/${workspaceId}`, ownerToken, { role: 'admin' }),
        call('delete', `${base}/members/${otherUserId}`, ownerToken),
        call('post', `${base}/leave`, ownerToken),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: { code: 'WORKSPACE_NOT_FOUND' } });
      }
    }
    const { rows } = await pool.query('SELECT 1 FROM users WHERE id = $1', [otherUserId]);
    expect(rows).toHaveLength(1);
  });

  it('answers ID_INVALID for a malformed workspace id', async () => {
    await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');

    const response = await call('get', '/v1/workspaces/nope', ownerToken);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toEqual({ error: { code: 'ID_INVALID' } });
  });

  it('keeps one owner when two owners demote each other at the same time', async () => {
    const { workspaceId, userId: firstId } = await registerTenant('owner@acme.co');
    const firstToken = await login('owner@acme.co');
    const secondId = await addMember(workspaceId, firstToken, 'boss@acme.co', 'owner');
    const secondToken = await login('boss@acme.co');
    const members = `/v1/workspaces/${workspaceId}/members`;

    const statuses = (
      await Promise.all([
        call('patch', `${members}/${secondId}`, firstToken, { role: 'admin' }),
        call('patch', `${members}/${firstId}`, secondToken, { role: 'admin' }),
      ])
    )
      .map((response) => response.status)
      .sort((a, b) => a - b);

    expect(statuses).toEqual([204, 403]);
    const { rows } = await pool.query("SELECT 1 FROM workspace_members WHERE role = 'owner'");
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
      role: 'superuser',
    }).expect(422);

    expect(invalid.body).toEqual({
      error: { code: 'INPUT_INVALID', fields: [{ path: 'role', code: 'invalid_value' }] },
    });
  });
});
