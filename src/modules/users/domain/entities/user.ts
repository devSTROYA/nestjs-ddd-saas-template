import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';
import type { TenantId } from '@modules/tenants';
import { UserCreatedEvent, UserRenamedEvent } from '../events/user.events.js';
import type { UserId } from '../value-objects/user-id.js';
import type { UserName } from '../value-objects/user-name.js';

type Props = {
  tenantId: TenantId;
  email: Email;
  name: UserName;
  createdAt: Date;
};

type CreateProps = {
  tenantId: TenantId;
  email: Email;
  name: UserName;
};

export class User extends AggregateRoot<Props, UserId> {
  static create(props: CreateProps, id: UserId): User {
    const now = new Date();
    const user = new User(
      { tenantId: props.tenantId, email: props.email, name: props.name, createdAt: now },
      id,
    );
    user.addEvent(
      new UserCreatedEvent({
        aggregateId: id,
        tenantId: props.tenantId,
        occurredAt: now.toISOString(),
        email: props.email.value,
        userName: props.name.value,
      }),
    );
    return user;
  }

  static restore(props: Props, id: UserId): User {
    return new User(props, id);
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
      new UserRenamedEvent({
        aggregateId: this.id,
        tenantId: this.tenantId,
        occurredAt: new Date().toISOString(),
        userName: name.value,
      }),
    );
  }
}
