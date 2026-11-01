import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';
import type { TenantId } from '@modules/tenants';
import { UserCreatedEvent, UserRenamedEvent } from '../events/user.events.js';
import type { UserId } from '../value-objects/user-id.js';
import type { UserName } from '../value-objects/user-name.js';

type UserProps = {
  tenantId: TenantId;
  email: Email;
  name: UserName;
  createdAt: Date;
};

type CreateUserProps = {
  tenantId: TenantId;
  email: Email;
  name: UserName;
};

type RestoreUserProps = {
  tenantId: TenantId;
  email: Email;
  name: UserName;
  createdAt: Date;
};

export class User extends AggregateRoot<UserProps, UserId> {
  static create(props: CreateUserProps, id: UserId): User {
    const now = new Date();
    const user = new User(
      { tenantId: props.tenantId, email: props.email, name: props.name, createdAt: now },
      id,
    );
    user.addEvent(
      new UserCreatedEvent(
        id,
        props.tenantId,
        now.toISOString(),
        props.email.value,
        props.name.value,
      ),
    );
    return user;
  }

  static restore(props: RestoreUserProps, id: UserId): User {
    return new User(
      {
        tenantId: props.tenantId,
        email: props.email,
        name: props.name,
        createdAt: props.createdAt,
      },
      id,
    );
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }

  get email(): Email {
    return this.props.email;
  }

  get name(): UserName {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  rename(name: UserName): void {
    this.props.name = name;
    this.addEvent(
      new UserRenamedEvent(this.id, this.tenantId, new Date().toISOString(), name.value),
    );
  }
}
