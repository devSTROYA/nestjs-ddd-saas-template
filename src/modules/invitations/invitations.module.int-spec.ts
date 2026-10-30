import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { validateEnv } from '@common/config';
import { newAdminId } from '@modules/admins';

import { MAILER } from './application/ports/mailer.js';
import {
  AcceptInvitationCommand,
  type AcceptInvitationResult,
} from './application/use-cases/accept-invitation/accept-invitation.command.js';
import { InviteTenantCommand } from './application/use-cases/invite-tenant/invite-tenant.command.js';
import { InvalidOtpError, InvitationNotPendingError } from './domain/errors/domain.error.js';
import type { InvitationId } from './domain/value-objects/invitation-id.js';
import { InvitationsModule } from './invitations.module.js';
import { FakeMailer } from './testing/fakes.js';

const ADMIN_ID = newAdminId();

describe('InvitationsModule', () => {
  const pool = new Pool({ connectionString: inject('databaseUrl') });
  const mailer = new FakeMailer();
  let app: INestApplication;
  let bus: CommandBus;

  const count = async (table: 'tenants' | 'users'): Promise<number> => {
    const { rows } = await pool.query<{ total: string }>(`SELECT count(*) AS total FROM ${table}`);
    return Number(rows[0]?.total);
  };

  const invite = (email = 'owner@acme.co'): Promise<InvitationId> =>
    bus.execute<InviteTenantCommand, InvitationId>(new InviteTenantCommand(ADMIN_ID, email));

  const accept = (id: InvitationId, otp: string): Promise<AcceptInvitationResult> =>
    bus.execute<AcceptInvitationCommand, AcceptInvitationResult>(
      new AcceptInvitationCommand(id, otp, 'Acme', 'Uz'),
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () =>
            validateEnv({
              DATABASE_URL: inject('databaseUrl'),
              OTP_SECRET: 'x'.repeat(32),
              JWT_SECRET: 'y'.repeat(32),
            }),
        }),
        CqrsModule.forRoot(),
        InvitationsModule,
      ],
    })
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    bus = app.get(CommandBus);
  });

  beforeEach(async () => {
    mailer.sent.length = 0;
    await pool.query('TRUNCATE TABLE invitations, users, tenants, admins CASCADE');
    await pool.query("INSERT INTO admins (id, email) VALUES ($1, 'root@b.co')", [ADMIN_ID]);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('invites a tenant and lets the invitee accept with the emailed otp', async () => {
    const id = await invite();
    const otp = mailer.sent[0]?.otp ?? '';

    const result = await accept(id, otp);

    const tenant = await pool.query('SELECT name FROM tenants WHERE id = $1', [result.tenantId]);
    const user = await pool.query('SELECT email, tenant_id FROM users WHERE id = $1', [
      result.userId,
    ]);
    expect(tenant.rows).toEqual([{ name: 'Acme' }]);
    expect(user.rows).toEqual([{ email: 'owner@acme.co', tenant_id: result.tenantId }]);
  });

  it('keeps the failed attempt, creates nothing, and still accepts the right otp afterwards', async () => {
    const id = await invite();
    const otp = mailer.sent[0]?.otp ?? '';

    await expect(accept(id, otp === '000000' ? '111111' : '000000')).rejects.toThrow(
      InvalidOtpError,
    );
    const { rows } = await pool.query('SELECT attempts FROM invitations WHERE id = $1', [id]);
    expect(rows).toEqual([{ attempts: 1 }]);
    expect(await count('tenants')).toBe(0);

    await accept(id, otp);
    expect(await count('tenants')).toBe(1);
  });

  it('creates only one tenant when the same invitation is accepted concurrently', async () => {
    const id = await invite();
    const otp = mailer.sent[0]?.otp ?? '';

    const outcomes = await Promise.allSettled([accept(id, otp), accept(id, otp)]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      InvitationNotPendingError,
    );
    expect(await count('tenants')).toBe(1);
    expect(await count('users')).toBe(1);
  });

  it('resends with a new otp when the same email is invited again', async () => {
    const first = await invite();
    const second = await invite();

    expect(second).toBe(first);
    expect(mailer.sent).toHaveLength(2);
  });
});
