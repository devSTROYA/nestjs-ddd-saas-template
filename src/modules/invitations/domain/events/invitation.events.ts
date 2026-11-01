import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const InvitationEventNames = {
  CREATED: 'invitation.created',
  ACCEPTED: 'invitation.accepted',
  OTP_FAILED: 'invitation.otp_failed',
  REVOKED: 'invitation.revoked',
  OTP_REGENERATED: 'invitation.otp_regenerated',
} as const;

type InvitationEventProps = Omit<DomainEventProps, 'tenantId'>;

// INFO: Invitations are platform-level, so tenantId is always null.
export class InvitationCreatedEvent extends DomainEvent {
  readonly name = InvitationEventNames.CREATED;
  readonly email: string;
  readonly invitedBy: string;
  readonly expiresAt: string;

  constructor(
    props: InvitationEventProps & { email: string; invitedBy: string; expiresAt: string },
  ) {
    super({ ...props, tenantId: null });
    this.email = props.email;
    this.invitedBy = props.invitedBy;
    this.expiresAt = props.expiresAt;
  }
}

export class InvitationAcceptedEvent extends DomainEvent {
  readonly name = InvitationEventNames.ACCEPTED;
  readonly email: string;

  constructor(props: InvitationEventProps & { email: string }) {
    super({ ...props, tenantId: null });
    this.email = props.email;
  }
}

export class InvitationOtpFailedEvent extends DomainEvent {
  readonly name = InvitationEventNames.OTP_FAILED;
  readonly attempts: number;

  constructor(props: InvitationEventProps & { attempts: number }) {
    super({ ...props, tenantId: null });
    this.attempts = props.attempts;
  }
}

export class InvitationRevokedEvent extends DomainEvent {
  readonly name = InvitationEventNames.REVOKED;
  readonly email: string;

  constructor(props: InvitationEventProps & { email: string }) {
    super({ ...props, tenantId: null });
    this.email = props.email;
  }
}

export class InvitationOtpRegeneratedEvent extends DomainEvent {
  readonly name = InvitationEventNames.OTP_REGENERATED;
  readonly expiresAt: string;

  constructor(props: InvitationEventProps & { expiresAt: string }) {
    super({ ...props, tenantId: null });
    this.expiresAt = props.expiresAt;
  }
}
