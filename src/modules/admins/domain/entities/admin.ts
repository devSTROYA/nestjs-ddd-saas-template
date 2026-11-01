import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';

import { AdminCreatedEvent, AdminEmailChangedEvent } from '../events/admin.events.js';
import type { AdminId } from '../value-objects/admin-id.js';

type Props = {
  email: Email;
  createdAt: Date;
};

type CreateProps = {
  email: Email;
};

export class Admin extends AggregateRoot<Props, AdminId> {
  static create(props: CreateProps, id: AdminId): Admin {
    const now = new Date();
    const admin = new Admin({ email: props.email, createdAt: now }, id);
    admin.addEvent(new AdminCreatedEvent(id, null, now.toISOString(), props.email.value));
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

  changeEmail(email: Email): void {
    this.props.email = email;
    this.addEvent(new AdminEmailChangedEvent(this.id, null, new Date().toISOString(), email.value));
  }
}
