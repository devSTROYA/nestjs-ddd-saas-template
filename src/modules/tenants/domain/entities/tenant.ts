import { AggregateRoot } from '@common/ddd';

import { TenantCreatedEvent, TenantRenamedEvent } from '../events/tenant.events.js';
import { TenantId } from '../value-objects/tenant-id.js';
import type { TenantName } from '../value-objects/tenant-name.js';

type Props = {
  name: TenantName;
  createdAt: Date;
};

type CreateProps = {
  name: TenantName;
  createdAt: Date;
};

export class Tenant extends AggregateRoot<Props, TenantId> {
  static create(props: CreateProps): Tenant {
    const id = TenantId.create();
    const tenant = new Tenant({ name: props.name, createdAt: props.createdAt }, id);
    tenant.addEvent(
      new TenantCreatedEvent({
        aggregateId: id.value,
        tenantId: id.value,
        occurredAt: props.createdAt.toISOString(),
        tenantName: props.name.value,
      }),
    );
    return tenant;
  }

  static restore(props: Props, id: TenantId): Tenant {
    return new Tenant(props, id);
  }

  get name(): TenantName {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  rename(name: TenantName, now: Date): void {
    this.props.name = name;
    this.addEvent(
      new TenantRenamedEvent({
        aggregateId: this.id.value,
        tenantId: this.id.value,
        occurredAt: now.toISOString(),
        tenantName: name.value,
      }),
    );
  }
}
