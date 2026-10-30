import type { Email } from '@common/primitives';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '../value-objects/user-id.js';
import type { UserName } from '../value-objects/user-name.js';

export class User {
  private constructor(
    public readonly id: UserId,
    public readonly tenantId: TenantId,
    public readonly email: Email,
    private _name: UserName,
    public readonly createdAt: Date,
  ) {}

  static create(props: { id: UserId; tenantId: TenantId; email: Email; name: UserName }): User {
    return new User(props.id, props.tenantId, props.email, props.name, new Date());
  }

  static restore(props: {
    id: UserId;
    tenantId: TenantId;
    email: Email;
    name: UserName;
    createdAt: Date;
  }): User {
    return new User(props.id, props.tenantId, props.email, props.name, props.createdAt);
  }

  get name(): UserName {
    return this._name;
  }

  rename(name: UserName): void {
    this._name = name;
  }
}
