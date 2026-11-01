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
import { LoginChallengeId } from '../value-objects/ids.js';
import { LoginChallengeStatus } from '../value-objects/login-challenge-status.js';

export const MAX_LOGIN_ATTEMPTS = 5;

type Props = {
  tenantId: Nullable<TenantId>;
  email: Email;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  status: LoginChallengeStatus;
  createdAt: Date;
};

type CreateProps = {
  tenantId: Nullable<TenantId>;
  email: Email;
  otpHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export class LoginChallenge extends AggregateRoot<Props, LoginChallengeId> {
  // INFO: the OTP hash is bound to the challenge id, so the caller creates the id first.
  static create(
    props: CreateProps,
    id: LoginChallengeId = LoginChallengeId.create(),
  ): LoginChallenge {
    const challenge = new LoginChallenge(
      {
        tenantId: props.tenantId,
        email: props.email,
        otpHash: props.otpHash,
        expiresAt: props.expiresAt,
        attempts: 0,
        status: LoginChallengeStatus.PENDING,
        createdAt: props.createdAt,
      },
      id,
    );
    challenge.addEvent(
      new LoginChallengeCreatedEvent({
        aggregateId: id.value,
        tenantId: props.tenantId?.value ?? null,
        occurredAt: props.createdAt.toISOString(),
        expiresAt: props.expiresAt.toISOString(),
      }),
    );
    return challenge;
  }

  static restore(props: Props, id: LoginChallengeId): LoginChallenge {
    return new LoginChallenge(props, id);
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
        new LoginChallengeAttemptFailedEvent({
          aggregateId: this.id.value,
          tenantId: this.props.tenantId?.value ?? null,
          occurredAt: now.toISOString(),
          attempts: this.props.attempts,
        }),
      );
      return false;
    }
    this.props.status = LoginChallengeStatus.CONSUMED;
    this.addEvent(
      new LoginChallengeConsumedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId?.value ?? null,
        occurredAt: now.toISOString(),
      }),
    );
    return true;
  }

  regenerate(otpHash: string, expiresAt: Date, now: Date): void {
    this.props.otpHash = otpHash;
    this.props.expiresAt = expiresAt;
    this.props.attempts = 0;
    this.addEvent(
      new LoginChallengeRegeneratedEvent({
        aggregateId: this.id.value,
        tenantId: this.props.tenantId?.value ?? null,
        occurredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }),
    );
  }
}
