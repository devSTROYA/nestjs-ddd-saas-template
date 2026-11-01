import { AggregateRoot } from '@common/ddd';

import { TenantCreatedEvent, TenantRenamedEvent } from '../events/tenant.events.js';
import type { TenantId } from '../value-objects/tenant-id.js';
import type { TenantName } from '../value-objects/tenant-name.js';

type TenantProps = {
  name: TenantName;
  createdAt: Date;
};

type CreateTenantProps = {
  name: TenantName;
};

type RestoreTenantProps = {
  name: TenantName;
  createdAt: Date;
};

export class Tenant extends AggregateRoot<TenantProps, TenantId> {
  static create(props: CreateTenantProps, id: TenantId): Tenant {
    const now = new Date();
    const tenant = new Tenant({ name: props.name, createdAt: now }, id);
    tenant.addEvent(new TenantCreatedEvent(id, id, now.toISOString(), props.name.value));
    return tenant;
  }

  static restore(props: RestoreTenantProps, id: TenantId): Tenant {
    return new Tenant({ name: props.name, createdAt: props.createdAt }, id);
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
