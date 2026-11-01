import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import {
  LoginChallengeAttemptFailedEvent,
  LoginChallengeConsumedEvent,
  LoginChallengeCreatedEvent,
  LoginChallengeRegeneratedEvent,
} from '../events/login-challenge.events.js';
import type { LoginChallengeId } from '../value-objects/ids.js';
import { LoginChallengeStatus } from '../value-objects/login-challenge-status.js';

export const MAX_LOGIN_ATTEMPTS = 5;

type LoginChallengeProps = {
  tenantId: Nullable<TenantId>;
  email: Email;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  status: LoginChallengeStatus;
  createdAt: Date;
};

type CreateLoginChallengeProps = {
  tenantId: Nullable<TenantId>;
  email: Email;
  otpHash: string;
  expiresAt: Date;
};

type RestoreLoginChallengeProps = {
  tenantId: Nullable<TenantId>;
  email: Email;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  status: LoginChallengeStatus;
  createdAt: Date;
};

export class LoginChallenge extends AggregateRoot<LoginChallengeProps, LoginChallengeId> {
  static create(props: CreateLoginChallengeProps, id: LoginChallengeId, now: Date): LoginChallenge {
    const challenge = new LoginChallenge(
      {
        tenantId: props.tenantId,
        email: props.email,
        otpHash: props.otpHash,
        expiresAt: props.expiresAt,
        attempts: 0,
        status: LoginChallengeStatus.PENDING,
        createdAt: now,
      },
      id,
    );
    challenge.addEvent(
      new LoginChallengeCreatedEvent(
        id,
        props.tenantId,
        now.toISOString(),
        props.expiresAt.toISOString(),
      ),
    );
    return challenge;
  }

  static restore(props: RestoreLoginChallengeProps, id: LoginChallengeId): LoginChallenge {
    return new LoginChallenge(
      {
        tenantId: props.tenantId,
        email: props.email,
        otpHash: props.otpHash,
        expiresAt: props.expiresAt,
        attempts: props.attempts,
        status: props.status,
        createdAt: props.createdAt,
      },
      id,
    );
  }

  get tenantId(): Nullable<TenantId> {
    return this.props.tenantId;
  }

  get email(): Email {
    return this.props.email;
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

  get status(): LoginChallengeStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  verify(otpMatches: boolean, now: Date): boolean {
    if (
      this.props.status !== LoginChallengeStatus.PENDING ||
      now >= this.props.expiresAt ||
      this.props.attempts >= MAX_LOGIN_ATTEMPTS
    ) {
      return false;
    }
    if (!otpMatches) {
      this.props.attempts += 1;
      this.addEvent(
        new LoginChallengeAttemptFailedEvent(
          this.id,
          this.props.tenantId,
          now.toISOString(),
          this.props.attempts,
        ),
      );
      return false;
    }
    this.props.status = LoginChallengeStatus.CONSUMED;
    this.addEvent(new LoginChallengeConsumedEvent(this.id, this.props.tenantId, now.toISOString()));
    return true;
  }

  regenerate(otpHash: string, expiresAt: Date): void {
    this.props.otpHash = otpHash;
    this.props.expiresAt = expiresAt;
    this.props.attempts = 0;
    this.addEvent(
      new LoginChallengeRegeneratedEvent(
        this.id,
        this.props.tenantId,
        new Date().toISOString(),
        expiresAt.toISOString(),
      ),
    );
  }
}
