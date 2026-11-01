import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { inject } from 'vitest';

import { AdminId } from '@modules/admins';

import { configureApp } from '../../../configure-app.js';
import { MAILER } from '../application/ports/mailer.js';
import { InviteTenantCommand } from '../application/use-cases/invite-tenant/invite-tenant.command.js';
import { InvitationId } from '../domain/value-objects/invitation-id.js';
import { FakeMailer } from '../testing/fakes.js';

const ADMIN_ID = AdminId.create();
const VALID_BODY = { tenantName: 'Acme', userName: 'Uz' };

describe('InvitationsController', () => {
  const pool = new Pool({ connectionString: inject('databaseUrl') });
  const mailer = new FakeMailer();
  let app: NestFastifyApplication;
  let invitationId: InvitationId;
  let otp: string;

  const accept = (id: string, body: unknown) =>
    request(app.getHttpServer())
      .post(`/v1/invitations/${id}/accept`)
      .send(body as object);

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', inject('databaseUrl'));
    vi.stubEnv('OTP_SECRET', 'x'.repeat(32));
    vi.stubEnv('JWT_SECRET', 'y'.repeat(32));
    const { AppModule } = await import('../../../app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app, { docs: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(async () => {
    mailer.sent.length = 0;
    await pool.query('TRUNCATE TABLE rate_limits, invitations, users, tenants, admins CASCADE');
    await pool.query("INSERT INTO admins (id, email) VALUES ($1, 'root@b.co')", [ADMIN_ID.value]);
    invitationId = await app
      .get(CommandBus)
      .execute<InviteTenantCommand, InvitationId>(
        new InviteTenantCommand(ADMIN_ID.value, 'owner@acme.co'),
      );
    otp = mailer.sent[0]?.otp ?? '';
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    vi.unstubAllEnvs();
  });

  it('creates the tenant and owner and answers 201 with their ids', async () => {
    const response = await accept(invitationId.value, { ...VALID_BODY, otp }).expect(201);

    const { tenantId, userId } = response.body as { tenantId: string; userId: string };
    const user = await pool.query('SELECT email, tenant_id FROM users WHERE id = $1', [userId]);
    expect(user.rows).toEqual([{ email: 'owner@acme.co', tenant_id: tenantId }]);
  });

  it('answers 422 with the error code for a wrong otp', async () => {
    const wrong = otp === '000000' ? '111111' : '000000';

    const response = await accept(invitationId.value, { ...VALID_BODY, otp: wrong }).expect(422);

    expect(response.body).toEqual({ error: { code: 'INVITATION_OTP_INVALID' } });
  });

  it('answers 422 INPUT_INVALID listing every invalid field', async () => {
    const response = await accept(invitationId.value, { otp: '12', tenantName: 1 }).expect(422);

    expect(response.body).toEqual({
      error: {
        code: 'INPUT_INVALID',
        fields: [
          { path: 'otp', code: 'invalid_format' },
          { path: 'tenantName', code: 'invalid_type' },
          { path: 'userName', code: 'invalid_type' },
        ],
      },
    });
  });

  it('answers 422 ID_INVALID for a malformed invitation id', async () => {
    const response = await accept('not-an-id', { ...VALID_BODY, otp }).expect(422);

    expect(response.body).toEqual({ error: { code: 'ID_INVALID' } });
  });

  it('answers 404 for an unknown invitation', async () => {
    const response = await accept(InvitationId.create().value, { ...VALID_BODY, otp }).expect(404);

    expect(response.body).toEqual({ error: { code: 'INVITATION_NOT_FOUND' } });
  });

  it('answers 422 for an empty tenant name', async () => {
    const response = await accept(invitationId.value, {
      ...VALID_BODY,
      tenantName: '  ',
      otp,
    }).expect(422);

    expect(response.body).toEqual({ error: { code: 'TENANT_NAME_EMPTY' } });
  });

  it('refuses to invite an email that already belongs to a registered user', async () => {
    await accept(invitationId.value, { ...VALID_BODY, otp }).expect(201);

    await expect(
      app.get(CommandBus).execute(new InviteTenantCommand(ADMIN_ID.value, 'owner@acme.co')),
    ).rejects.toMatchObject({ code: 'INVITATION_EMAIL_ALREADY_REGISTERED' });
  });

  it('answers 409 when the invitation was already accepted', async () => {
    await accept(invitationId.value, { ...VALID_BODY, otp }).expect(201);

    const response = await accept(invitationId.value, { ...VALID_BODY, otp }).expect(409);

    expect(response.body).toEqual({ error: { code: 'INVITATION_NOT_PENDING' } });
  });
});
