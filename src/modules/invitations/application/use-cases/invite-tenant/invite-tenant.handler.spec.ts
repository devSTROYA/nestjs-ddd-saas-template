import { Email, InvalidEmailError } from '@common/primitives';
import { AdminId } from '@modules/admins';
import { TenantId } from '@modules/tenants';
import { User, UserName } from '@modules/users';

import { InvitationEmailAlreadyRegisteredError } from '../../../domain/errors/domain.error.js';
import { InvitationStatus } from '../../../domain/value-objects/invitation-status.js';
import {
  FakeInvitations,
  FakeMailer,
  FakeUsers,
  OTP,
  fakeOtpService,
  fixedClock,
} from '../../../testing/fakes.js';
import { InviteTenantCommand } from './invite-tenant.command.js';
import { INVITATION_TTL_MS, InviteTenantHandler } from './invite-tenant.handler.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const ADMIN_ID = AdminId.create();

const setup = () => {
  const invitations = new FakeInvitations();
  const users = new FakeUsers();
  const mailer = new FakeMailer();
  const handler = new InviteTenantHandler(
    invitations,
    users,
    fakeOtpService,
    mailer,
    fixedClock(NOW),
  );
  return { handler, invitations, users, mailer };
};

describe('InviteTenantHandler', () => {
  it('creates a pending invitation for the admin and emails the otp', async () => {
    const { handler, invitations, mailer } = setup();

    const id = await handler.execute(new InviteTenantCommand(ADMIN_ID.value, ' New@Tenant.co '));

    const invitation = invitations.saved.get(id.value);
    expect(invitation?.email.value).toBe('new@tenant.co');
    expect(invitation?.invitedBy).toEqual(ADMIN_ID);
    expect(invitation?.status).toBe(InvitationStatus.PENDING);
    expect(invitation?.otpHash).toBe(fakeOtpService.hash(id.value, OTP));
    expect(invitation?.expiresAt).toEqual(new Date(NOW.getTime() + INVITATION_TTL_MS));
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ invitationId: id, otp: OTP });
    expect(mailer.sent[0]?.to.value).toBe('new@tenant.co');
  });

  it('expires the invitation after seven days', () => {
    expect(INVITATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('resends on the same pending invitation instead of creating another', async () => {
    const { handler, invitations, mailer } = setup();

    const first = await handler.execute(new InviteTenantCommand(ADMIN_ID.value, 'new@tenant.co'));
    invitations.saved.get(first.value)?.accept(false, NOW);
    const second = await handler.execute(
      new InviteTenantCommand(AdminId.create().value, 'new@tenant.co'),
    );

    expect(second).toEqual(first);
    expect(invitations.saved.size).toBe(1);
    expect(invitations.saved.get(first.value)?.attempts).toBe(0);
    expect(invitations.saved.get(first.value)?.invitedBy).toEqual(ADMIN_ID);
    expect(mailer.sent).toHaveLength(2);
  });

  it('creates a new invitation when the previous one is no longer pending', async () => {
    const { handler, invitations } = setup();
    const first = await handler.execute(new InviteTenantCommand(ADMIN_ID.value, 'new@tenant.co'));
    invitations.saved.get(first.value)?.revoke(NOW);

    const second = await handler.execute(new InviteTenantCommand(ADMIN_ID.value, 'new@tenant.co'));

    expect(second).not.toEqual(first);
    expect(invitations.saved.size).toBe(2);
  });

  it('rejects an email that already belongs to a registered user, without a mail', async () => {
    const { handler, invitations, users, mailer } = setup();
    await users.save(
      User.create({
        tenantId: TenantId.create(),
        email: Email.create('owner@tenant.co'),
        name: UserName.create('Owner'),
        createdAt: NOW,
      }),
    );

    await expect(
      handler.execute(new InviteTenantCommand(ADMIN_ID.value, ' Owner@Tenant.co ')),
    ).rejects.toThrow(InvitationEmailAlreadyRegisteredError);

    expect(invitations.saves).toBe(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects an invalid email before touching anything', async () => {
    const { handler, invitations, mailer } = setup();

    await expect(handler.execute(new InviteTenantCommand(ADMIN_ID.value, 'nope'))).rejects.toThrow(
      InvalidEmailError,
    );
    expect(invitations.saves).toBe(0);
    expect(mailer.sent).toHaveLength(0);
  });
});
