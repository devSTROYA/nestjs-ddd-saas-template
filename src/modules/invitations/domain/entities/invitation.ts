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
import type { InvitationId } from '../value-objects/invitation-id.js';
import { InvitationStatus } from '../value-objects/invitation-status.js';

export const MAX_OTP_ATTEMPTS = 5;

type InvitationProps = {
  email: Email;
  invitedBy: AdminId;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  status: InvitationStatus;
  createdAt: Date;
};

export class Invitation extends AggregateRoot<InvitationProps, InvitationId> {
  static create(
    props: {
      id: InvitationId;
      email: Email;
      invitedBy: AdminId;
      otpHash: string;
      expiresAt: Date;
    },
    now: Date,
  ): Invitation {
    const invitation = new Invitation(
      {
        email: props.email,
        invitedBy: props.invitedBy,
        otpHash: props.otpHash,
        expiresAt: props.expiresAt,
        attempts: 0,
        status: InvitationStatus.PENDING,
        createdAt: now,
      },
      props.id,
    );
    invitation.addEvent(
      new InvitationCreatedEvent(
        props.id,
        now.toISOString(),
        props.email.value,
        props.invitedBy,
        props.expiresAt.toISOString(),
      ),
    );
    return invitation;
  }

  static restore(props: {
    id: InvitationId;
    email: Email;
    invitedBy: AdminId;
    otpHash: string;
    expiresAt: Date;
    attempts: number;
    status: InvitationStatus;
    createdAt: Date;
  }): Invitation {
    return new Invitation(
      {
        email: props.email,
        invitedBy: props.invitedBy,
        otpHash: props.otpHash,
        expiresAt: props.expiresAt,
        attempts: props.attempts,
        status: props.status,
        createdAt: props.createdAt,
      },
      props.id,
    );
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

  // A wrong OTP does not throw: the caller must persist the attempt before raising InvalidOtpError.
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
      this.addEvent(new InvitationOtpFailedEvent(this.id, now.toISOString(), this.props.attempts));
      return false;
    }
    this.props.status = InvitationStatus.ACCEPTED;
    this.addEvent(new InvitationAcceptedEvent(this.id, now.toISOString(), this.props.email.value));
    return true;
  }

  revoke(): void {
    this.assertPending();
    this.props.status = InvitationStatus.REVOKED;
    this.addEvent(
      new InvitationRevokedEvent(this.id, new Date().toISOString(), this.props.email.value),
    );
  }

  regenerate(otpHash: string, expiresAt: Date): void {
    this.assertPending();
    this.props.otpHash = otpHash;
    this.props.expiresAt = expiresAt;
    this.props.attempts = 0;
    this.addEvent(
      new InvitationOtpRegeneratedEvent(this.id, new Date().toISOString(), expiresAt.toISOString()),
    );
  }

  private assertPending(): void {
    if (this.props.status !== InvitationStatus.PENDING) {
      throw new InvitationNotPendingError(this.props.status);
    }
  }
}
