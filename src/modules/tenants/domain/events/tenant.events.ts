import { DomainEvent } from '@common/ddd';
import type { Nullable } from '@common/types';

export const TenantEventNames = {
  CREATED: 'tenant.created',
  RENAMED: 'tenant.renamed',
} as const;

export class TenantCreatedEvent extends DomainEvent {
  readonly name = TenantEventNames.CREATED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    readonly tenantName: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class TenantRenamedEvent extends DomainEvent {
  readonly name = TenantEventNames.RENAMED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    readonly tenantName: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}
