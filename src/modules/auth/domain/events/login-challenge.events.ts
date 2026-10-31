import { DomainEvent } from '@common/ddd';
import type { Nullable } from '@common/types';

export const LoginChallengeEventNames = {
  CREATED: 'login_challenge.created',
  CONSUMED: 'login_challenge.consumed',
  ATTEMPT_FAILED: 'login_challenge.attempt_failed',
  REGENERATED: 'login_challenge.regenerated',
} as const;

export class LoginChallengeCreatedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.CREATED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    public readonly expiresAt: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class LoginChallengeConsumedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.CONSUMED;
}

export class LoginChallengeAttemptFailedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.ATTEMPT_FAILED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    public readonly attempts: number,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class LoginChallengeRegeneratedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.REGENERATED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    public readonly expiresAt: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}
