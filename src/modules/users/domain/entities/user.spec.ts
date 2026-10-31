import { Email } from '@common/primitives';
import { newTenantId } from '@modules/tenants';

import { UserEventNames } from '../events/user.events.js';
import { newUserId } from '../value-objects/user-id.js';
import { UserName } from '../value-objects/user-name.js';
import { User } from './user.js';

const TENANT_ID = newTenantId();

const newUser = (): User =>
  User.create({
    id: newUserId(),
    tenantId: TENANT_ID,
    email: Email.create('a@b.c'),
    name: UserName.create('Uz'),
  });

describe('User', () => {
  it('creates with the given id, tenant, email and name', () => {
    const id = newUserId();
    const user = User.create({
      id,
      tenantId: TENANT_ID,
      email: Email.create('a@b.c'),
      name: UserName.create('Uz'),
    });
    expect(user.id).toBe(id);
    expect(user.tenantId).toBe(TENANT_ID);
    expect(user.email.value).toBe('a@b.c');
    expect(user.name.value).toBe('Uz');
  });

  it('renames', () => {
    const user = newUser();
    user.rename(UserName.create('Xy'));
    expect(user.name.value).toBe('Xy');
  });

  it('raises created and renamed events, once', () => {
    const user = newUser();
    user.rename(UserName.create('Xy'));

    const events = user.pullEvents();

    expect(events).toMatchObject([
      {
        name: UserEventNames.CREATED,
        aggregateId: user.id,
        tenantId: TENANT_ID,
        email: 'a@b.c',
        userName: 'Uz',
      },
      { name: UserEventNames.RENAMED, aggregateId: user.id, tenantId: TENANT_ID, userName: 'Xy' },
    ]);
    expect(user.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const user = User.restore({
      id: newUserId(),
      tenantId: TENANT_ID,
      email: Email.restore('a@b.c'),
      name: UserName.restore('Uz'),
      createdAt: new Date(),
    });
    expect(user.pullEvents()).toEqual([]);
  });

  it('restores without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const user = User.restore({
      id: newUserId(),
      tenantId: TENANT_ID,
      email: Email.restore('a@b.c'),
      name: UserName.restore('Uz'),
      createdAt,
    });
    expect(user.createdAt).toBe(createdAt);
  });
});
