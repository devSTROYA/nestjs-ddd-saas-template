import type { Email } from '@common/primitives';
import type { AdminId } from '@modules/admins';

import {
  InvitationExpiredError,
  InvitationLockedError,
  InvitationNotPendingError,
} from '../errors/domain.error.js';
import type { InvitationId } from '../value-objects/invitation-id.js';
import { InvitationStatus } from '../value-objects/invitation-status.js';

export const MAX_OTP_ATTEMPTS = 5;

export class Invitation {
  private constructor(
    public readonly id: InvitationId,
    public readonly email: Email,
    public readonly invitedBy: AdminId,
    private _otpHash: string,
    private _expiresAt: Date,
    private _attempts: number,
    private _status: InvitationStatus,
    public readonly createdAt: Date,
  ) {}

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
    return new Invitation(
      props.id,
      props.email,
      props.invitedBy,
      props.otpHash,
      props.expiresAt,
      0,
      InvitationStatus.PENDING,
      now,
    );
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
      props.id,
      props.email,
      props.invitedBy,
      props.otpHash,
      props.expiresAt,
      props.attempts,
      props.status,
      props.createdAt,
    );
  }

  get otpHash(): string {
    return this._otpHash;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get attempts(): number {
    return this._attempts;
  }

  get status(): InvitationStatus {
    return this._status;
  }

  // A wrong OTP does not throw: the caller must persist the attempt before raising InvalidOtpError.
  accept(otpMatches: boolean, now: Date): boolean {
    this.assertPending();
    if (now >= this._expiresAt) {
      throw new InvitationExpiredError();
    }
    if (this._attempts >= MAX_OTP_ATTEMPTS) {
      throw new InvitationLockedError();
    }
    if (!otpMatches) {
      this._attempts += 1;
      return false;
    }
    this._status = InvitationStatus.ACCEPTED;
    return true;
  }

  revoke(): void {
    this.assertPending();
    this._status = InvitationStatus.REVOKED;
  }

  regenerate(otpHash: string, expiresAt: Date): void {
    this.assertPending();
    this._otpHash = otpHash;
    this._expiresAt = expiresAt;
    this._attempts = 0;
  }

  private assertPending(): void {
    if (this._status !== InvitationStatus.PENDING) {
      throw new InvitationNotPendingError(this._status);
    }
  }
}
