import { Email } from '@common/primitives';

import { AdminEventNames } from '../events/admin.events.js';
import { newAdminId } from '../value-objects/admin-id.js';
import { Admin } from './admin.js';

const newAdmin = (): Admin => Admin.create({ email: Email.create('root@b.co') }, newAdminId());

describe('Admin', () => {
  it('creates with the given id and email', () => {
    const id = newAdminId();
    const admin = Admin.create({ email: Email.create('root@b.co') }, id);
    expect(admin.id).toBe(id);
    expect(admin.email.value).toBe('root@b.co');
  });

  it('changes the email', () => {
    const admin = newAdmin();
    admin.changeEmail(Email.create('new@b.co'));
    expect(admin.email.value).toBe('new@b.co');
  });

  it('raises created and email_changed events, once', () => {
    const admin = newAdmin();
    admin.changeEmail(Email.create('new@b.co'));

    const events = admin.pullEvents();

    expect(events).toMatchObject([
      { name: AdminEventNames.CREATED, aggregateId: admin.id, tenantId: null, email: 'root@b.co' },
      {
        name: AdminEventNames.EMAIL_CHANGED,
        aggregateId: admin.id,
        tenantId: null,
        email: 'new@b.co',
      },
    ]);
    expect(admin.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const admin = Admin.restore(
      { email: Email.restore('root@b.co'), createdAt: new Date() },
      newAdminId(),
    );
    expect(admin.pullEvents()).toEqual([]);
  });

  it('restores without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const admin = Admin.restore({ email: Email.restore('root@b.co'), createdAt }, newAdminId());
    expect(admin.createdAt).toBe(createdAt);
  });
});
