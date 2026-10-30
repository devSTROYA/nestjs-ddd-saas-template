import type { Email } from '@common/primitives';
import type { TenantId } from '@modules/tenants';

import type { LoginChallengeId } from '../value-objects/ids.js';
import { LoginChallengeStatus } from '../value-objects/login-challenge-status.js';

export const MAX_LOGIN_ATTEMPTS = 5;

export class LoginChallenge {
  private constructor(
    public readonly id: LoginChallengeId,
    public readonly tenantId: TenantId | null,
    public readonly email: Email,
    private _otpHash: string,
    private _expiresAt: Date,
    private _attempts: number,
    private _status: LoginChallengeStatus,
    public readonly createdAt: Date,
  ) {}

  static create(
    props: {
      id: LoginChallengeId;
      tenantId: TenantId | null;
      email: Email;
      otpHash: string;
      expiresAt: Date;
    },
    now: Date,
  ): LoginChallenge {
    return new LoginChallenge(
      props.id,
      props.tenantId,
      props.email,
      props.otpHash,
      props.expiresAt,
      0,
      LoginChallengeStatus.PENDING,
      now,
    );
  }

  static restore(props: {
    id: LoginChallengeId;
    tenantId: TenantId | null;
    email: Email;
    otpHash: string;
    expiresAt: Date;
    attempts: number;
    status: LoginChallengeStatus;
    createdAt: Date;
  }): LoginChallenge {
    return new LoginChallenge(
      props.id,
      props.tenantId,
      props.email,
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

  get status(): LoginChallengeStatus {
    return this._status;
  }

  verify(otpMatches: boolean, now: Date): boolean {
    if (
      this._status !== LoginChallengeStatus.PENDING ||
      now >= this._expiresAt ||
      this._attempts >= MAX_LOGIN_ATTEMPTS
    ) {
      return false;
    }
    if (!otpMatches) {
      this._attempts += 1;
      return false;
    }
    this._status = LoginChallengeStatus.CONSUMED;
    return true;
  }

  regenerate(otpHash: string, expiresAt: Date): void {
    this._otpHash = otpHash;
    this._expiresAt = expiresAt;
    this._attempts = 0;
  }
}
