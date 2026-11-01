import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const TenantEventNames = {
  CREATED: 'tenant.created',
  RENAMED: 'tenant.renamed',
} as const;

export class TenantCreatedEvent extends DomainEvent {
  readonly name = TenantEventNames.CREATED;
  readonly tenantName: string;

  constructor(props: DomainEventProps & { tenantName: string }) {
    super(props);
    this.tenantName = props.tenantName;
  }
}

export class TenantRenamedEvent extends DomainEvent {
  readonly name = TenantEventNames.RENAMED;
  readonly tenantName: string;

  constructor(props: DomainEventProps & { tenantName: string }) {
    super(props);
    this.tenantName = props.tenantName;
  }
}
