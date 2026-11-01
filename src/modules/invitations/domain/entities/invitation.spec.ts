import { Email } from '@common/primitives';
import { newAdminId } from '@modules/admins';

import {
  InvitationExpiredError,
  InvitationLockedError,
  InvitationNotPendingError,
} from '../errors/domain.error.js';
import { InvitationEventNames } from '../events/invitation.events.js';
import { newInvitationId } from '../value-objects/invitation-id.js';
import { InvitationStatus } from '../value-objects/invitation-status.js';
import { Invitation, MAX_OTP_ATTEMPTS } from './invitation.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const IN_10_MIN = new Date(NOW.getTime() + 10 * 60_000);
const AFTER_EXPIRY = new Date(IN_10_MIN.getTime() + 1);

const newInvitation = (): Invitation =>
  Invitation.create(
    {
      email: Email.create('a@b.co'),
      invitedBy: newAdminId(),
      otpHash: 'hash',
      expiresAt: IN_10_MIN,
    },
    newInvitationId(),
    NOW,
  );

describe('Invitation', () => {
  it('starts pending with zero attempts', () => {
    const invitation = newInvitation();
    expect(invitation.status).toBe(InvitationStatus.PENDING);
    expect(invitation.attempts).toBe(0);
    expect(invitation.createdAt).toBe(NOW);
  });

  it('accepts on a matching otp', () => {
    const invitation = newInvitation();
    expect(invitation.accept(true, NOW)).toBe(true);
    expect(invitation.status).toBe(InvitationStatus.ACCEPTED);
  });

  it('records a failed attempt on a wrong otp and stays pending', () => {
    const invitation = newInvitation();
    expect(invitation.accept(false, NOW)).toBe(false);
    expect(invitation.attempts).toBe(1);
    expect(invitation.status).toBe(InvitationStatus.PENDING);
  });

  it('locks after the maximum number of wrong attempts', () => {
    const invitation = newInvitation();
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) {
      invitation.accept(false, NOW);
    }
    expect(() => invitation.accept(true, NOW)).toThrow(InvitationLockedError);
  });

  it('rejects an expired invitation', () => {
    expect(() => newInvitation().accept(true, AFTER_EXPIRY)).toThrow(InvitationExpiredError);
  });

  it('cannot be accepted, revoked or regenerated once it is not pending', () => {
    const accepted = newInvitation();
    accepted.accept(true, NOW);
    expect(() => accepted.accept(true, NOW)).toThrow(InvitationNotPendingError);
    expect(() => accepted.revoke()).toThrow(InvitationNotPendingError);
    expect(() => accepted.regenerate('x', IN_10_MIN)).toThrow(InvitationNotPendingError);

    const revoked = newInvitation();
    revoked.revoke();
    expect(revoked.status).toBe(InvitationStatus.REVOKED);
    expect(() => revoked.accept(true, NOW)).toThrow(InvitationNotPendingError);
  });

  it('raises an event for create and every mutation, once', () => {
    const invitation = newInvitation();
    expect(invitation.pullEvents()).toMatchObject([
      {
        name: InvitationEventNames.CREATED,
        aggregateId: invitation.id,
        tenantId: null,
        email: 'a@b.co',
        expiresAt: IN_10_MIN.toISOString(),
        occurredAt: NOW.toISOString(),
      },
    ]);

    invitation.accept(false, NOW);
    const later = new Date(IN_10_MIN.getTime() + 60_000);
    invitation.regenerate('hash2', later);
    invitation.accept(true, NOW);

    const events = invitation.pullEvents();
    expect(events).toMatchObject([
      { name: InvitationEventNames.OTP_FAILED, attempts: 1 },
      { name: InvitationEventNames.OTP_REGENERATED, expiresAt: later.toISOString() },
      { name: InvitationEventNames.ACCEPTED, email: 'a@b.co' },
    ]);
    expect(JSON.stringify(events)).not.toContain('hash');
    expect(invitation.pullEvents()).toEqual([]);

    const revoked = newInvitation();
    revoked.pullEvents();
    revoked.revoke();
    expect(revoked.pullEvents()).toMatchObject([{ name: InvitationEventNames.REVOKED }]);
  });

  it('raises no event when rejected or on restore', () => {
    const accepted = newInvitation();
    accepted.accept(true, NOW);
    accepted.pullEvents();
    expect(() => accepted.revoke()).toThrow(InvitationNotPendingError);
    expect(accepted.pullEvents()).toEqual([]);

    const restored = Invitation.restore(
      {
        email: Email.create('a@b.co'),
        invitedBy: newAdminId(),
        otpHash: 'hash',
        expiresAt: IN_10_MIN,
        attempts: 0,
        status: InvitationStatus.PENDING,
        createdAt: NOW,
      },
      newInvitationId(),
    );
    expect(restored.pullEvents()).toEqual([]);
  });

  it('regenerate swaps the hash, extends expiry and resets attempts', () => {
    const invitation = newInvitation();
    invitation.accept(false, NOW);
    const later = new Date(IN_10_MIN.getTime() + 60_000);

    invitation.regenerate('hash2', later);

    expect(invitation.otpHash).toBe('hash2');
    expect(invitation.expiresAt).toBe(later);
    expect(invitation.attempts).toBe(0);
  });
});
