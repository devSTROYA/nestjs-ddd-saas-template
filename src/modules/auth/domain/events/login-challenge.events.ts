import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const LoginChallengeEventNames = {
  CREATED: 'login_challenge.created',
  CONSUMED: 'login_challenge.consumed',
  ATTEMPT_FAILED: 'login_challenge.attempt_failed',
  REGENERATED: 'login_challenge.regenerated',
} as const;

export class LoginChallengeCreatedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.CREATED;
  readonly expiresAt: string;

  constructor(props: DomainEventProps & { expiresAt: string }) {
    super(props);
    this.expiresAt = props.expiresAt;
  }
}

export class LoginChallengeConsumedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.CONSUMED;
}

export class LoginChallengeAttemptFailedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.ATTEMPT_FAILED;
  readonly attempts: number;

  constructor(props: DomainEventProps & { attempts: number }) {
    super(props);
    this.attempts = props.attempts;
  }
}

export class LoginChallengeRegeneratedEvent extends DomainEvent {
  readonly name = LoginChallengeEventNames.REGENERATED;
  readonly expiresAt: string;

  constructor(props: DomainEventProps & { expiresAt: string }) {
    super(props);
    this.expiresAt = props.expiresAt;
  }
}
