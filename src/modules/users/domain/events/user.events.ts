import { DomainEvent } from '@common/ddd';
import type { Nullable } from '@common/types';

export const UserEventNames = {
  CREATED: 'user.created',
  RENAMED: 'user.renamed',
} as const;

export class UserCreatedEvent extends DomainEvent {
  readonly name = UserEventNames.CREATED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    readonly email: string,
    readonly userName: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class UserRenamedEvent extends DomainEvent {
  readonly name = UserEventNames.RENAMED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    readonly userName: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}
