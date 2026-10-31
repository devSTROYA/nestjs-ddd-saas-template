import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { inject } from 'vitest';

import { DEFAULT_RATE_LIMIT } from '@common/rate-limit';
import { newAdminId } from '@modules/admins';

import { LOGIN_MAILER } from '../application/ports/login-mailer.js';
import { LOGIN_CODE_PER_EMAIL } from '../application/rate-limits.js';
import { LOGIN_VERIFY_PER_IP } from './auth.rate-limits.js';
import { FakeLoginMailer } from '../testing/fakes.js';
import { configureApp } from '../../../configure-app.js';

const ADMIN_ID = newAdminId();
const ADMIN_EMAIL = 'root@b.co';

type TokenBody = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
};

describe('AuthController', () => {
  const pool = new Pool({ connectionString: inject('databaseUrl') });
  const mailer = new FakeLoginMailer();
  let app: NestFastifyApplication;

  const post = (path: string, body: object, bearer?: string) => {
    const call = request(app.getHttpServer()).post(path).send(body);
    return bearer ? call.set('authorization', `Bearer ${bearer}`) : call;
  };

  const login = async (): Promise<TokenBody> => {
    await post('/v1/auth/admin/otp', { email: ADMIN_EMAIL }).expect(202);
    const otp = mailer.sent.at(-1)?.otp ?? '';
    const response = await post('/v1/auth/admin/token', { email: ADMIN_EMAIL, otp }).expect(200);
    return response.body as TokenBody;
  };

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', inject('databaseUrl'));
    vi.stubEnv('OTP_SECRET', 'x'.repeat(32));
    vi.stubEnv('JWT_SECRET', 'y'.repeat(32));
    const { AppModule } = await import('../../../app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LOGIN_MAILER)
      .useValue(mailer)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app, { docs: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    mailer.sent.length = 0;
    await pool.query(
      'TRUNCATE TABLE rate_limits, refresh_tokens, login_challenges, invitations, users, tenants, admins CASCADE',
    );
    await pool.query('INSERT INTO admins (id, email) VALUES ($1, $2)', [ADMIN_ID, ADMIN_EMAIL]);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    vi.unstubAllEnvs();
  });

  it('emails a code to an admin and answers 202 with no body', async () => {
    const response = await post('/v1/auth/admin/otp', { email: ADMIN_EMAIL }).expect(202);

    expect(response.text).toBe('');
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to.value).toBe(ADMIN_EMAIL);
  });

  it('answers 202 for an unknown email and sends nothing', async () => {
    await post('/v1/auth/admin/otp', { email: 'stranger@b.co' }).expect(202);

    expect(mailer.sent).toHaveLength(0);
  });

  it('exchanges the code for tokens', async () => {
    const tokens = await login();

    expect(tokens.tokenType).toBe('Bearer');
    expect(tokens.expiresIn).toBe(900);
    expect(tokens.accessToken.split('.')).toHaveLength(3);
    expect(tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { rows } = await pool.query('SELECT token_hash FROM refresh_tokens');
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(tokens.refreshToken);
  });

  it('gives the same 401 for a wrong code and for an unknown email', async () => {
    await post('/v1/auth/admin/otp', { email: ADMIN_EMAIL }).expect(202);
    const otp = mailer.sent[0]?.otp ?? '';
    const wrong = otp === '000000' ? '111111' : '000000';

    const wrongCode = await post('/v1/auth/admin/token', { email: ADMIN_EMAIL, otp: wrong });
    const unknown = await post('/v1/auth/admin/token', { email: 'stranger@b.co', otp });

    expect(wrongCode.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongCode.body).toEqual({ error: { code: 'AUTH_CREDENTIALS_INVALID' } });
    expect(unknown.body).toEqual(wrongCode.body);
  });

  it('answers 422 INPUT_INVALID for a malformed body', async () => {
    const response = await post('/v1/auth/admin/token', { email: ADMIN_EMAIL, otp: '12' }).expect(
      422,
    );

    expect(response.body).toEqual({
      error: { code: 'INPUT_INVALID', fields: [{ path: 'otp', code: 'invalid_format' }] },
    });
  });

  it('protects the invite endpoint: 401 without a valid access token, 201 with one', async () => {
    const body = { email: 'owner@acme.co' };
    const withoutToken = await post('/v1/invitations', body).expect(401);
    await post('/v1/invitations', body, 'garbage').expect(401);
    const { accessToken } = await login();

    const created = await post('/v1/invitations', body, accessToken).expect(201);

    expect(withoutToken.body).toEqual({ error: { code: 'AUTH_UNAUTHENTICATED' } });
    expect((created.body as { invitationId: string }).invitationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('lets a tenant user log in with just their email, and keeps them out of admin endpoints', async () => {
    const tenantId = '0198f0a2-0000-7000-8000-0000000000a1';
    await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'Acme')", [tenantId]);
    await pool.query(
      "INSERT INTO users (id, tenant_id, email, name) VALUES ($1, $2, 'owner@acme.co', 'Owner')",
      ['0198f0a2-0000-7000-8000-0000000000a2', tenantId],
    );
    const body = { email: 'owner@acme.co' };

    await post('/v1/auth/user/otp', body).expect(202);
    await post('/v1/auth/user/otp', { email: 'stranger@acme.co' }).expect(202);
    expect(mailer.sent).toHaveLength(1);
    const otp = mailer.sent[0]?.otp ?? '';
    const wrong = otp === '000000' ? '111111' : '000000';

    const rejected = await post('/v1/auth/user/token', { ...body, otp: wrong }).expect(401);
    const tokens = (await post('/v1/auth/user/token', { ...body, otp }).expect(200))
      .body as TokenBody;
    const refreshed = (
      await post('/v1/auth/refresh', { refreshToken: tokens.refreshToken }).expect(200)
    ).body as TokenBody;
    const forbidden = await post(
      '/v1/invitations',
      { email: 'x@y.co' },
      refreshed.accessToken,
    ).expect(403);

    expect(rejected.body).toEqual({ error: { code: 'AUTH_CREDENTIALS_INVALID' } });
    expect(forbidden.body).toEqual({ error: { code: 'AUTH_FORBIDDEN' } });
    const { rows } = await pool.query('SELECT tenant_id FROM refresh_tokens');
    expect(rows).toEqual([{ tenant_id: tenantId }, { tenant_id: tenantId }]);
  });

  it('keeps the accept endpoint public', async () => {
    const response = await post('/v1/invitations/0198f0a2-0000-7000-8000-000000000001/accept', {
      otp: '123456',
      tenantName: 'Acme',
      userName: 'Uz',
    });

    expect(response.status).toBe(404);
  });

  it('rotates the refresh token and revokes the whole session when an old one is replayed', async () => {
    const first = await login();
    const second = (
      await post('/v1/auth/refresh', { refreshToken: first.refreshToken }).expect(200)
    ).body as TokenBody;
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const replay = await post('/v1/auth/refresh', { refreshToken: first.refreshToken }).expect(401);
    const afterReplay = await post('/v1/auth/refresh', {
      refreshToken: second.refreshToken,
    }).expect(401);

    expect(replay.body).toEqual({ error: { code: 'AUTH_REFRESH_TOKEN_INVALID' } });
    expect(afterReplay.body).toEqual(replay.body);
  });

  it('logs out: 204, then the refresh token no longer works, and logging out twice is fine', async () => {
    const tokens = await login();

    await post('/v1/auth/logout', { refreshToken: tokens.refreshToken }).expect(204);
    await post('/v1/auth/refresh', { refreshToken: tokens.refreshToken }).expect(401);
    await post('/v1/auth/logout', { refreshToken: tokens.refreshToken }).expect(204);
    await post('/v1/auth/logout', { refreshToken: 'never-issued' }).expect(204);
  });

  describe('rate limiting', () => {
    it('limits login code requests per email, the same for an admin and a stranger', async () => {
      for (const email of [ADMIN_EMAIL, 'stranger@b.co']) {
        await pool.query('TRUNCATE TABLE rate_limits');
        for (let i = 0; i < LOGIN_CODE_PER_EMAIL.limit; i++) {
          await post('/v1/auth/admin/otp', { email }).expect(202);
        }
        const blocked = await post('/v1/auth/admin/otp', { email }).expect(429);

        expect(blocked.body).toMatchObject({ error: { code: 'RATE_LIMIT_EXCEEDED' } });
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      }
      expect(mailer.sent).toHaveLength(LOGIN_CODE_PER_EMAIL.limit);
    });

    it('limits code verification attempts per IP and reports when to retry', async () => {
      const attempt = () => post('/v1/auth/admin/token', { email: ADMIN_EMAIL, otp: '000000' });

      for (let i = 0; i < LOGIN_VERIFY_PER_IP.default.limit; i++) {
        await attempt().expect(401);
      }
      const blocked = await attempt().expect(429);

      expect(blocked.body).toEqual({
        error: { code: 'RATE_LIMIT_EXCEEDED', retryAfterSeconds: expect.any(Number) },
      });
      expect(Number(blocked.headers['retry-after'])).toBe(
        (blocked.body as { error: { retryAfterSeconds: number } }).error.retryAfterSeconds,
      );
    });

    it('limits requests before authentication, so unauthenticated floods are stopped too', async () => {
      for (let i = 0; i < DEFAULT_RATE_LIMIT.limit; i++) {
        await post('/v1/invitations', { email: 'owner@acme.co' }).expect(401);
      }

      await post('/v1/invitations', { email: 'owner@acme.co' }).expect(429);
    });

    it('does not limit the health endpoints', async () => {
      for (let i = 0; i < DEFAULT_RATE_LIMIT.limit + 5; i++) {
        await request(app.getHttpServer()).get('/v1/health/live').expect(200);
      }
      await request(app.getHttpServer()).get('/v1/health/ready').expect(200);
    });
  });
});
