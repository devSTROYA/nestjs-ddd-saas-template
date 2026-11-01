import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';
import type { AdminId } from '@modules/admins';

import {
  InvitationExpiredError,
  InvitationLockedError,
  InvitationNotPendingError,
} from '../errors/domain.error.js';
import {
  InvitationAcceptedEvent,
  InvitationCreatedEvent,
  InvitationOtpFailedEvent,
  InvitationOtpRegeneratedEvent,
  InvitationRevokedEvent,
} from '../events/invitation.events.js';
import { InvitationId } from '../value-objects/invitation-id.js';
import { InvitationStatus } from '../value-objects/invitation-status.js';

export const MAX_OTP_ATTEMPTS = 5;

type Props = {
  email: Email;
  invitedBy: AdminId;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  status: InvitationStatus;
  createdAt: Date;
};

type CreateProps = {
  email: Email;
  invitedBy: AdminId;
  otpHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export class Invitation extends AggregateRoot<Props, InvitationId> {
  // INFO: the OTP hash is bound to the invitation id, so the caller creates the id first.
  static create(props: CreateProps, id: InvitationId = InvitationId.create()): Invitation {
    const invitation = new Invitation(
      {
        email: props.email,
        invitedBy: props.invitedBy,
        otpHash: props.otpHash,
        expiresAt: props.expiresAt,
        attempts: 0,
        status: InvitationStatus.PENDING,
        createdAt: props.createdAt,
      },
      id,
    );
    invitation.addEvent(
      new InvitationCreatedEvent({
        aggregateId: id.value,
        occurredAt: props.createdAt.toISOString(),
        email: props.email.value,
        invitedBy: props.invitedBy.value,
        expiresAt: props.expiresAt.toISOString(),
      }),
    );
    return invitation;
  }

  static restore(props: Props, id: InvitationId): Invitation {
    return new Invitation(props, id);
  }

  get email(): Email {
    return this.props.email;
  }

  get invitedBy(): AdminId {
    return this.props.invitedBy;
  }

  get otpHash(): string {
    return this.props.otpHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get status(): InvitationStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // INFO: A wrong OTP does not throw; the caller persists the attempt before raising InvalidOtpError.
  accept(otpMatches: boolean, now: Date): boolean {
    this.assertPending();
    if (now >= this.props.expiresAt) {
      throw new InvitationExpiredError();
    }
    if (this.props.attempts >= MAX_OTP_ATTEMPTS) {
      throw new InvitationLockedError();
    }
    if (!otpMatches) {
      this.props.attempts += 1;
      this.addEvent(
        new InvitationOtpFailedEvent({
          aggregateId: this.id.value,
          occurredAt: now.toISOString(),
          attempts: this.props.attempts,
        }),
      );
      return false;
    }
    this.props.status = InvitationStatus.ACCEPTED;
    this.addEvent(
      new InvitationAcceptedEvent({
        aggregateId: this.id.value,
        occurredAt: now.toISOString(),
        email: this.props.email.value,
      }),
    );
    return true;
  }

  revoke(now: Date): void {
    this.assertPending();
    this.props.status = InvitationStatus.REVOKED;
    this.addEvent(
      new InvitationRevokedEvent({
        aggregateId: this.id.value,
        occurredAt: now.toISOString(),
        email: this.props.email.value,
      }),
    );
  }

  regenerate(otpHash: string, expiresAt: Date, now: Date): void {
    this.assertPending();
    this.props.otpHash = otpHash;
    this.props.expiresAt = expiresAt;
    this.props.attempts = 0;
    this.addEvent(
      new InvitationOtpRegeneratedEvent({
        aggregateId: this.id.value,
        occurredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }),
    );
  }

  private assertPending(): void {
    if (this.props.status !== InvitationStatus.PENDING) {
      throw new InvitationNotPendingError(this.props.status);
    }
  }
}
