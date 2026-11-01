import { Email } from '@common/primitives';

import { AdminEventNames } from '../events/admin.events.js';
import { AdminId } from '../value-objects/admin-id.js';
import { Admin } from './admin.js';

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-02-01T00:00:00Z');

const newAdmin = (): Admin =>
  Admin.create({ email: Email.create('root@b.co'), createdAt: CREATED_AT });

describe('Admin', () => {
  it('creates with the given id, email and createdAt', () => {
    const id = AdminId.create();
    const admin = Admin.create({ email: Email.create('root@b.co'), createdAt: CREATED_AT }, id);
    expect(admin.id.equals(id)).toBe(true);
    expect(admin.email.value).toBe('root@b.co');
    expect(admin.createdAt).toEqual(CREATED_AT);
  });

  it('changes the email', () => {
    const admin = newAdmin();
    admin.changeEmail(Email.create('new@b.co'), NOW);
    expect(admin.email.value).toBe('new@b.co');
  });

  it('raises created and email_changed events, once, stamped with the given times', () => {
    const admin = newAdmin();
    admin.changeEmail(Email.create('new@b.co'), NOW);

    const events = admin.pullEvents();

    expect(events).toMatchObject([
      {
        name: AdminEventNames.CREATED,
        aggregateId: admin.id.value,
        tenantId: null,
        email: 'root@b.co',
        occurredAt: CREATED_AT.toISOString(),
      },
      {
        name: AdminEventNames.EMAIL_CHANGED,
        aggregateId: admin.id.value,
        tenantId: null,
        email: 'new@b.co',
        occurredAt: NOW.toISOString(),
      },
    ]);
    expect(admin.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const admin = Admin.restore(
      { email: Email.restore('root@b.co'), createdAt: new Date() },
      AdminId.create(),
    );
    expect(admin.pullEvents()).toEqual([]);
  });

  it('restores without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const admin = Admin.restore({ email: Email.restore('root@b.co'), createdAt }, AdminId.create());
    expect(admin.createdAt).toBe(createdAt);
  });
});
