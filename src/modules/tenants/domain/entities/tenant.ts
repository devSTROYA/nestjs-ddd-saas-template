import { AggregateRoot } from '@common/ddd';

import { TenantCreatedEvent, TenantRenamedEvent } from '../events/tenant.events.js';
import type { TenantId } from '../value-objects/tenant-id.js';
import type { TenantName } from '../value-objects/tenant-name.js';

type TenantProps = {
  name: TenantName;
  createdAt: Date;
};

export class Tenant extends AggregateRoot<TenantProps, TenantId> {
  static create(props: { id: TenantId; name: TenantName }): Tenant {
    const now = new Date();
    const tenant = new Tenant({ name: props.name, createdAt: now }, props.id);
    tenant.addEvent(
      new TenantCreatedEvent(props.id, props.id, now.toISOString(), props.name.value),
    );
    return tenant;
  }

  static restore(props: { id: TenantId; name: TenantName; createdAt: Date }): Tenant {
    return new Tenant({ name: props.name, createdAt: props.createdAt }, props.id);
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
