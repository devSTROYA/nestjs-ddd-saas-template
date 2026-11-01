import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';
import type { TenantId } from '@modules/tenants';
import { UserCreatedEvent, UserRenamedEvent } from '../events/user.events.js';
import { UserId } from '../value-objects/user-id.js';
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
  createdAt: Date;
};

export class User extends AggregateRoot<Props, UserId> {
  static create(props: CreateProps): User {
    const id = UserId.create();
    const user = new User(
      {
        tenantId: props.tenantId,
        email: props.email,
        name: props.name,
        createdAt: props.createdAt,
      },
      id,
    );
    user.addEvent(
      new UserCreatedEvent({
        aggregateId: id.value,
        tenantId: props.tenantId.value,
        occurredAt: props.createdAt.toISOString(),
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

  rename(name: UserName, now: Date): void {
    this.props.name = name;
    this.addEvent(
      new UserRenamedEvent({
        aggregateId: this.id.value,
        tenantId: this.tenantId.value,
        occurredAt: now.toISOString(),
        userName: name.value,
      }),
    );
  }
}
