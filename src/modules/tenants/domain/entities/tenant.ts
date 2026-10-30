import type { TenantId } from '../value-objects/tenant-id.js';
import type { TenantName } from '../value-objects/tenant-name.js';

export class Tenant {
  private constructor(
    public readonly id: TenantId,
    private _name: TenantName,
    public readonly createdAt: Date,
  ) {}

  static create(props: { id: TenantId; name: TenantName }): Tenant {
    return new Tenant(props.id, props.name, new Date());
  }

  static restore(props: { id: TenantId; name: TenantName; createdAt: Date }): Tenant {
    return new Tenant(props.id, props.name, props.createdAt);
  }

  get name(): TenantName {
    return this._name;
  }

  rename(name: TenantName): void {
    this._name = name;
  }
}
