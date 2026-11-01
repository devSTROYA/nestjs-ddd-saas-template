import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';

import { AdminCreatedEvent, AdminEmailChangedEvent } from '../events/admin.events.js';
import { AdminId } from '../value-objects/admin-id.js';

type Props = {
  email: Email;
  createdAt: Date;
};

type CreateProps = {
  email: Email;
  createdAt: Date;
};

export class Admin extends AggregateRoot<Props, AdminId> {
  // INFO: the seeded admin has a fixed id.
  static create(props: CreateProps, id: AdminId = AdminId.create()): Admin {
    const admin = new Admin({ email: props.email, createdAt: props.createdAt }, id);
    admin.addEvent(
      new AdminCreatedEvent({
        aggregateId: id.value,
        tenantId: null,
        occurredAt: props.createdAt.toISOString(),
        email: props.email.value,
      }),
    );
    return admin;
  }

  static restore(props: Props, id: AdminId): Admin {
    return new Admin(props, id);
  }

  get email(): Email {
    return this.props.email;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  changeEmail(email: Email, now: Date): void {
    this.props.email = email;
    this.addEvent(
      new AdminEmailChangedEvent({
        aggregateId: this.id.value,
        tenantId: null,
        occurredAt: now.toISOString(),
        email: email.value,
      }),
    );
  }
}
