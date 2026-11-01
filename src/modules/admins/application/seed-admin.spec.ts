import { Email, InvalidEmailError } from '@common/primitives';
import type { Nullable } from '@common/types';

import { Admin } from '../domain/entities/admin.js';
import { AdminEmailAlreadyTakenError } from '../domain/errors/domain.error.js';
import { AdminId } from '../domain/value-objects/admin-id.js';
import type { AdminRepository } from './ports/admin.repository.js';
import { SEED_ADMIN_ID, seedAdmin } from './seed-admin.js';

class FakeAdmins implements AdminRepository {
  readonly byId = new Map<string, Admin>();
  saves = 0;

  findById(id: AdminId): Promise<Nullable<Admin>> {
    return Promise.resolve(this.byId.get(id.value) ?? null);
  }

  findByEmail(email: Email): Promise<Nullable<Admin>> {
    const found = [...this.byId.values()].find((admin) => admin.email.equals(email));
    return Promise.resolve(found ?? null);
  }

  save(admin: Admin): Promise<void> {
    const taken = [...this.byId.values()].some(
      (other) => !other.id.equals(admin.id) && other.email.equals(admin.email),
    );
    if (taken) {
      return Promise.reject(new AdminEmailAlreadyTakenError(admin.email.value));
    }
    this.byId.set(admin.id.value, admin);
    this.saves += 1;
    return Promise.resolve();
  }
}

const NOW = new Date('2026-01-01T00:00:00Z');

describe('seedAdmin', () => {
  it('creates the seed admin with the fixed id when none exists', async () => {
    const admins = new FakeAdmins();

    expect(await seedAdmin(admins, ' Root@B.co ', NOW)).toBe('created');
    expect(admins.byId.get(SEED_ADMIN_ID.value)?.email.value).toBe('root@b.co');
    expect(admins.byId.get(SEED_ADMIN_ID.value)?.createdAt).toEqual(NOW);
  });

  it('does nothing when the email is unchanged', async () => {
    const admins = new FakeAdmins();
    await seedAdmin(admins, 'root@b.co', NOW);

    expect(await seedAdmin(admins, 'ROOT@b.co', NOW)).toBe('unchanged');
    expect(admins.saves).toBe(1);
  });

  it('updates the email of the same admin when the env value changes', async () => {
    const admins = new FakeAdmins();
    await seedAdmin(admins, 'admin@mycompany.io', NOW);

    expect(await seedAdmin(admins, 'admin@mycompany.com', NOW)).toBe('updated');
    expect(admins.byId.size).toBe(1);
    expect(admins.byId.get(SEED_ADMIN_ID.value)?.email.value).toBe('admin@mycompany.com');
  });

  it('fails when the new email already belongs to another admin', async () => {
    const admins = new FakeAdmins();
    await seedAdmin(admins, 'root@b.co', NOW);
    await admins.save(Admin.create({ email: Email.create('taken@b.co'), createdAt: NOW }));

    await expect(seedAdmin(admins, 'taken@b.co', NOW)).rejects.toThrow(AdminEmailAlreadyTakenError);
  });

  it('rejects an invalid email', async () => {
    await expect(seedAdmin(new FakeAdmins(), 'nope', NOW)).rejects.toThrow(InvalidEmailError);
  });
});
