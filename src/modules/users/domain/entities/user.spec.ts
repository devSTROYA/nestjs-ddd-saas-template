import { Email } from '@common/primitives';
import { TenantId } from '@modules/tenants';

import { UserEventNames } from '../events/user.events.js';
import { UserId } from '../value-objects/user-id.js';
import { UserName } from '../value-objects/user-name.js';
import { User } from './user.js';

const TENANT_ID = TenantId.create();

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-02-01T00:00:00Z');

const newUser = (): User =>
  User.create({
    tenantId: TENANT_ID,
    email: Email.create('a@b.c'),
    name: UserName.create('Uz'),
    createdAt: CREATED_AT,
  });

describe('User', () => {
  it('creates with a generated id and the given tenant, email, name and createdAt', () => {
    const user = newUser();
    expect(user.id).toBeInstanceOf(UserId);
    expect(user.tenantId.equals(TENANT_ID)).toBe(true);
    expect(user.email.value).toBe('a@b.c');
    expect(user.name.value).toBe('Uz');
    expect(user.createdAt).toEqual(CREATED_AT);
  });

  it('renames', () => {
    const user = newUser();
    user.rename(UserName.create('Xy'), NOW);
    expect(user.name.value).toBe('Xy');
  });

  it('raises created and renamed events, once, stamped with the given times', () => {
    const user = newUser();
    user.rename(UserName.create('Xy'), NOW);

    const events = user.pullEvents();

    expect(events).toMatchObject([
      {
        name: UserEventNames.CREATED,
        aggregateId: user.id.value,
        tenantId: TENANT_ID.value,
        email: 'a@b.c',
        userName: 'Uz',
        occurredAt: CREATED_AT.toISOString(),
      },
      {
        name: UserEventNames.RENAMED,
        aggregateId: user.id.value,
        tenantId: TENANT_ID.value,
        userName: 'Xy',
        occurredAt: NOW.toISOString(),
      },
    ]);
    expect(user.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const user = User.restore(
      {
        tenantId: TENANT_ID,
        email: Email.restore('a@b.c'),
        name: UserName.restore('Uz'),
        createdAt: new Date(),
      },
      UserId.create(),
    );
    expect(user.pullEvents()).toEqual([]);
  });

  it('restores without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const user = User.restore(
      {
        tenantId: TENANT_ID,
        email: Email.restore('a@b.c'),
        name: UserName.restore('Uz'),
        createdAt,
      },
      UserId.create(),
    );
    expect(user.createdAt).toBe(createdAt);
  });
});
