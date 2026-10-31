import { DomainEvent } from '@common/ddd';
import type { Nullable } from '@common/types';

export const AdminEventNames = {
  CREATED: 'admin.created',
  EMAIL_CHANGED: 'admin.email_changed',
} as const;

export class AdminCreatedEvent extends DomainEvent {
  readonly name = AdminEventNames.CREATED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    readonly email: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class AdminEmailChangedEvent extends DomainEvent {
  readonly name = AdminEventNames.EMAIL_CHANGED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    readonly email: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}
