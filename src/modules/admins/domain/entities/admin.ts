import { AggregateRoot } from '@common/ddd';
import type { Email } from '@common/primitives';

import { AdminCreatedEvent, AdminEmailChangedEvent } from '../events/admin.events.js';
import type { AdminId } from '../value-objects/admin-id.js';

type AdminProps = {
  email: Email;
  createdAt: Date;
};

export class Admin extends AggregateRoot<AdminProps, AdminId> {
  static create(props: { id: AdminId; email: Email }): Admin {
    const now = new Date();
    const admin = new Admin({ email: props.email, createdAt: now }, props.id);
    admin.addEvent(new AdminCreatedEvent(props.id, null, now.toISOString(), props.email.value));
    return admin;
  }

  static restore(props: { id: AdminId; email: Email; createdAt: Date }): Admin {
    return new Admin({ email: props.email, createdAt: props.createdAt }, props.id);
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
