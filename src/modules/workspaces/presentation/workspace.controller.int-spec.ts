import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { inject } from 'vitest';

import { MAIL_TRANSPORT, type MailMessage } from '@common/mail';
import { newAdminId } from '@modules/admins';

import { configureApp } from '../../../configure-app.js';

const ADMIN_ID = newAdminId();

interface TokenBody {
  accessToken: string;
}

interface WorkspaceBody {
  id: string;
  name: string;
  role: string;
  members: { userId: string; role: string }[];
}

describe('WorkspaceController', () => {
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

  // Registers the owner the way production does: invite by an admin, accept with the emailed code.
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

    const response = await call('get', '/v1/workspace', token).expect(200);

    expect(response.body as WorkspaceBody).toEqual({
      id: workspaceId,
      name: 'Acme',
      role: 'owner',
      members: [{ userId, role: 'owner' }],
    });
  });

  it('lets an owner add a member, who can then log in, and another owner', async () => {
    await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');

    const added = await call('post', '/v1/workspace/members', ownerToken, {
      email: 'dev@acme.co',
      name: 'Dev',
      role: 'admin',
    }).expect(201);
    const second = await call('post', '/v1/workspace/members', ownerToken, {
      email: 'boss@acme.co',
      name: 'Boss',
      role: 'owner',
    }).expect(201);

    const memberToken = await login('dev@acme.co');
    const view = (await call('get', '/v1/workspace', memberToken).expect(200))
      .body as WorkspaceBody;
    expect(view.role).toBe('admin');
    expect(view.members).toHaveLength(3);
    expect((added.body as { userId: string }).userId).toMatch(/^[0-9a-f-]{36}$/);
    expect((second.body as { userId: string }).userId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers 403 to members who are not owners and 401 without a token', async () => {
    await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    await call('post', '/v1/workspace/members', ownerToken, {
      email: 'dev@acme.co',
      name: 'Dev',
      role: 'admin',
    }).expect(201);
    const memberToken = await login('dev@acme.co');

    const forbidden = await call('post', '/v1/workspace/members', memberToken, {
      email: 'x@acme.co',
      name: 'X',
      role: 'admin',
    }).expect(403);
    await call('get', '/v1/workspace').expect(401);

    expect(forbidden.body).toEqual({ error: { code: 'WORKSPACE_OWNER_REQUIRED' } });
  });

  it('keeps one owner: the last owner cannot leave or be demoted, others can', async () => {
    const { userId } = await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const added = await call('post', '/v1/workspace/members', ownerToken, {
      email: 'dev@acme.co',
      name: 'Dev',
      role: 'admin',
    }).expect(201);
    const devId = (added.body as { userId: string }).userId;

    const leave = await call('post', '/v1/workspace/leave', ownerToken).expect(409);
    const demote = await call('patch', `/v1/workspace/members/${userId}`, ownerToken, {
      role: 'admin',
    }).expect(409);
    await call('patch', `/v1/workspace/members/${devId}`, ownerToken, { role: 'owner' }).expect(
      204,
    );
    await call('post', '/v1/workspace/leave', ownerToken).expect(204);

    expect(leave.body).toEqual({ error: { code: 'WORKSPACE_LAST_OWNER_REQUIRED' } });
    expect(demote.body).toEqual(leave.body);
    const devToken = await login('dev@acme.co');
    const view = (await call('get', '/v1/workspace', devToken).expect(200)).body as WorkspaceBody;
    expect(view.members).toEqual([{ userId: devId, role: 'owner' }]);
  });

  it('lets an owner remove a member', async () => {
    await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const added = await call('post', '/v1/workspace/members', ownerToken, {
      email: 'dev@acme.co',
      name: 'Dev',
      role: 'admin',
    }).expect(201);

    await call(
      'delete',
      `/v1/workspace/members/${(added.body as { userId: string }).userId}`,
      ownerToken,
    ).expect(204);

    const view = (await call('get', '/v1/workspace', ownerToken).expect(200)).body as WorkspaceBody;
    expect(view.members).toHaveLength(1);

    await call('post', '/v1/auth/user/otp', undefined, { email: 'dev@acme.co' }).expect(202);
    await call('post', '/v1/auth/user/token', undefined, {
      email: 'dev@acme.co',
      otp: lastCode(),
    }).expect(401);
  });

  it('lets an owner add a removed email again as a new user, whose old token stays dead', async () => {
    await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const add = () =>
      call('post', '/v1/workspace/members', ownerToken, {
        email: 'dev@acme.co',
        name: 'Dev',
        role: 'admin',
      }).expect(201);
    const first = (await add()).body as { userId: string };
    const oldToken = await login('dev@acme.co');
    await call('delete', `/v1/workspace/members/${first.userId}`, ownerToken).expect(204);

    const second = (await add()).body as { userId: string };

    expect(second.userId).not.toBe(first.userId);
    await call('get', '/v1/workspace', oldToken).expect(404);
    const newToken = await login('dev@acme.co');
    await call('get', '/v1/workspace', newToken).expect(200);
  });

  it('cannot see, change or remove a user of another tenant', async () => {
    await registerTenant('owner@acme.co');
    const { userId: otherUserId } = await registerTenant('owner@beta.co');
    const ownerToken = await login('owner@acme.co');

    const changed = await call('patch', `/v1/workspace/members/${otherUserId}`, ownerToken, {
      role: 'admin',
    }).expect(404);
    const removed = await call('delete', `/v1/workspace/members/${otherUserId}`, ownerToken).expect(
      404,
    );

    expect(changed.body).toEqual({ error: { code: 'WORKSPACE_MEMBER_NOT_FOUND' } });
    expect(removed.body).toEqual({ error: { code: 'WORKSPACE_MEMBER_NOT_FOUND' } });
    const { rows } = await pool.query('SELECT 1 FROM users WHERE id = $1', [otherUserId]);
    expect(rows).toHaveLength(1);
  });

  it('keeps one owner when two owners demote each other at the same time', async () => {
    const { userId: firstId } = await registerTenant('owner@acme.co');
    const firstToken = await login('owner@acme.co');
    const second = await call('post', '/v1/workspace/members', firstToken, {
      email: 'boss@acme.co',
      name: 'Boss',
      role: 'owner',
    }).expect(201);
    const secondToken = await login('boss@acme.co');
    const secondId = (second.body as { userId: string }).userId;

    const statuses = (
      await Promise.all([
        call('patch', `/v1/workspace/members/${secondId}`, firstToken, { role: 'admin' }),
        call('patch', `/v1/workspace/members/${firstId}`, secondToken, { role: 'admin' }),
      ])
    )
      .map((response) => response.status)
      .sort((a, b) => a - b);

    expect(statuses).toEqual([204, 403]);
    const { rows } = await pool.query("SELECT 1 FROM workspace_members WHERE role = 'owner'");
    expect(rows).toHaveLength(1);
  });

  it('ends the access of a member who leaves', async () => {
    await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    await call('post', '/v1/workspace/members', ownerToken, {
      email: 'dev@acme.co',
      name: 'Dev',
      role: 'admin',
    }).expect(201);
    const devToken = await login('dev@acme.co');

    await call('post', '/v1/workspace/leave', devToken).expect(204);

    await call('post', '/v1/auth/user/otp', undefined, { email: 'dev@acme.co' }).expect(202);
    await call('post', '/v1/auth/user/token', undefined, {
      email: 'dev@acme.co',
      otp: lastCode(),
    }).expect(401);
  });

  it('keeps admins out and validates the body', async () => {
    await registerTenant('owner@acme.co');
    const ownerToken = await login('owner@acme.co');
    const adminToken = await loginAdmin();

    await call('get', '/v1/workspace', adminToken).expect(403);
    const invalid = await call('post', '/v1/workspace/members', ownerToken, {
      email: 'x@acme.co',
      name: 'X',
      role: 'superuser',
    }).expect(422);

    expect(invalid.body).toEqual({
      error: { code: 'INPUT_INVALID', fields: [{ path: 'role', code: 'invalid_value' }] },
    });
  });
});
