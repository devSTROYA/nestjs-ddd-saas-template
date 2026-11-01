import { AggregateRoot } from '@common/ddd';

import { TenantCreatedEvent, TenantRenamedEvent } from '../events/tenant.events.js';
import type { TenantId } from '../value-objects/tenant-id.js';
import type { TenantName } from '../value-objects/tenant-name.js';

type Props = {
  name: TenantName;
  createdAt: Date;
};

type CreateProps = {
  name: TenantName;
};

export class Tenant extends AggregateRoot<Props, TenantId> {
  static create(props: CreateProps, id: TenantId): Tenant {
    const now = new Date();
    const tenant = new Tenant({ name: props.name, createdAt: now }, id);
    tenant.addEvent(new TenantCreatedEvent(id, id, now.toISOString(), props.name.value));
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

  rename(name: TenantName): void {
    this.props.name = name;
    this.addEvent(new TenantRenamedEvent(this.id, this.id, new Date().toISOString(), name.value));
  }
}
