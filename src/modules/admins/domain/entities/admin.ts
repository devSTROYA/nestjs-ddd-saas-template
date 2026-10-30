import type { Email } from '@common/primitives';

import type { AdminId } from '../value-objects/admin-id.js';

export class Admin {
  private constructor(
    public readonly id: AdminId,
    private _email: Email,
    public readonly createdAt: Date,
  ) {}

  static create(props: { id: AdminId; email: Email }): Admin {
    return new Admin(props.id, props.email, new Date());
  }

  static restore(props: { id: AdminId; email: Email; createdAt: Date }): Admin {
    return new Admin(props.id, props.email, props.createdAt);
  }

  get email(): Email {
    return this._email;
  }

  changeEmail(email: Email): void {
    this._email = email;
  }
}
