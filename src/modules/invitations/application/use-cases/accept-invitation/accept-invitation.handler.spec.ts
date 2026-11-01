import { Email } from '@common/primitives';
import { newAdminId } from '@modules/admins';
import { EmptyTenantNameError } from '@modules/tenants';
import { EmptyNameError } from '@modules/users';

import { Invitation } from '../../../domain/entities/invitation.js';
import {
  InvalidOtpError,
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationNotPendingError,
} from '../../../domain/errors/domain.error.js';
import { type InvitationId, newInvitationId } from '../../../domain/value-objects/invitation-id.js';
import { InvitationStatus } from '../../../domain/value-objects/invitation-status.js';
import {
  FakeInvitations,
  FakeTenants,
  FakeUsers,
  FakeWorkspaces,
  OTP,
  fakeOtpService,
  fakeUnitOfWork,
  fixedClock,
} from '../../../testing/fakes.js';
import { AcceptInvitationCommand } from './accept-invitation.command.js';
import { AcceptInvitationHandler } from './accept-invitation.handler.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const IN_A_DAY = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);

const setup = async (expiresAt = IN_A_DAY) => {
  const invitations = new FakeInvitations();
  const tenants = new FakeTenants();
  const users = new FakeUsers();
  const workspaces = new FakeWorkspaces();
  const id = newInvitationId();
  await invitations.save(
    Invitation.create(
      {
        email: Email.create('owner@acme.co'),
        invitedBy: newAdminId(),
        otpHash: fakeOtpService.hash(id, OTP),
        expiresAt,
      },
      id,
      NOW,
    ),
  );
  invitations.saves = 0;
  const handler = new AcceptInvitationHandler(
    invitations,
    tenants,
    users,
    workspaces,
    fakeOtpService,
    fakeUnitOfWork,
    fixedClock(NOW),
  );
  return { handler, invitations, tenants, users, workspaces, id };
};

const accept = (id: InvitationId, otp = OTP, tenantName = ' Acme ', userName = ' Uz ') =>
  new AcceptInvitationCommand(id, otp, tenantName, userName);

describe('AcceptInvitationHandler', () => {
  it('creates the tenant, its owner and a workspace owned by them, and marks the invitation accepted', async () => {
    const { handler, invitations, tenants, users, workspaces, id } = await setup();

    const result = await handler.execute(accept(id));

    const workspace = workspaces.saved.get(result.workspaceId);
    expect(workspace?.tenantId).toBe(result.tenantId);
    expect(workspace?.name.value).toBe('Acme');
    expect(workspace?.members).toEqual([{ userId: result.userId, role: 'owner' }]);

    expect(tenants.saved.get(result.tenantId)?.name.value).toBe('Acme');
    expect(users.saved).toHaveLength(1);
    expect(users.saved[0]?.id).toBe(result.userId);
    expect(users.saved[0]?.tenantId).toBe(result.tenantId);
    expect(users.saved[0]?.email.value).toBe('owner@acme.co');
    expect(users.saved[0]?.name.value).toBe('Uz');
    expect(invitations.saved.get(id)?.status).toBe(InvitationStatus.ACCEPTED);
  });

  it('persists the failed attempt and creates nothing on a wrong otp', async () => {
    const { handler, invitations, tenants, users, id } = await setup();

    await expect(handler.execute(accept(id, '000000'))).rejects.toThrow(InvalidOtpError);

    expect(invitations.saves).toBe(1);
    expect(invitations.saved.get(id)?.attempts).toBe(1);
    expect(invitations.saved.get(id)?.status).toBe(InvitationStatus.PENDING);
    expect(tenants.saved.size).toBe(0);
    expect(users.saved).toHaveLength(0);
  });

  it('rejects an unknown invitation', async () => {
    const { handler } = await setup();

    await expect(handler.execute(accept(newInvitationId()))).rejects.toThrow(
      InvitationNotFoundError,
    );
  });

  it('rejects an expired invitation without creating anything', async () => {
    const { handler, tenants, users, id } = await setup(new Date(NOW.getTime() - 1));

    await expect(handler.execute(accept(id))).rejects.toThrow(InvitationExpiredError);
    expect(tenants.saved.size).toBe(0);
    expect(users.saved).toHaveLength(0);
  });

  it('cannot accept the same invitation twice', async () => {
    const { handler, tenants, id } = await setup();
    await handler.execute(accept(id));

    await expect(handler.execute(accept(id))).rejects.toThrow(InvitationNotPendingError);
    expect(tenants.saved.size).toBe(1);
  });

  it('validates the names before touching the invitation', async () => {
    const { handler, invitations, id } = await setup();

    await expect(handler.execute(accept(id, OTP, '  '))).rejects.toThrow(EmptyTenantNameError);
    await expect(handler.execute(accept(id, OTP, 'Acme', '  '))).rejects.toThrow(EmptyNameError);
    expect(invitations.saves).toBe(0);
    expect(invitations.saved.get(id)?.attempts).toBe(0);
  });
});
