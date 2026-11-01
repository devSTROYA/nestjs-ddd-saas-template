import { DomainEvent } from '@common/ddd';

export const InvitationEventNames = {
  CREATED: 'invitation.created',
  ACCEPTED: 'invitation.accepted',
  OTP_FAILED: 'invitation.otp_failed',
  REVOKED: 'invitation.revoked',
  OTP_REGENERATED: 'invitation.otp_regenerated',
} as const;

// INFO: Invitations are platform-level, so tenantId is always null.
export class InvitationCreatedEvent extends DomainEvent {
  readonly name = InvitationEventNames.CREATED;

  constructor(
    aggregateId: string,
    occurredAt: string,
    readonly email: string,
    readonly invitedBy: string,
    readonly expiresAt: string,
  ) {
    super(aggregateId, null, occurredAt);
  }
}

export class InvitationAcceptedEvent extends DomainEvent {
  readonly name = InvitationEventNames.ACCEPTED;

  constructor(
    aggregateId: string,
    occurredAt: string,
    readonly email: string,
  ) {
    super(aggregateId, null, occurredAt);
  }
}

export class InvitationOtpFailedEvent extends DomainEvent {
  readonly name = InvitationEventNames.OTP_FAILED;

  constructor(
    aggregateId: string,
    occurredAt: string,
    readonly attempts: number,
  ) {
    super(aggregateId, null, occurredAt);
  }
}

export class InvitationRevokedEvent extends DomainEvent {
  readonly name = InvitationEventNames.REVOKED;

  constructor(
    aggregateId: string,
    occurredAt: string,
    readonly email: string,
  ) {
    super(aggregateId, null, occurredAt);
  }
}

export class InvitationOtpRegeneratedEvent extends DomainEvent {
  readonly name = InvitationEventNames.OTP_REGENERATED;

  constructor(
    aggregateId: string,
    occurredAt: string,
    readonly expiresAt: string,
  ) {
    super(aggregateId, null, occurredAt);
  }
}
