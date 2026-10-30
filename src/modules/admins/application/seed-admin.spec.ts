import { Email, InvalidEmailError } from '@common/primitives';

import { Admin } from '../domain/entities/admin.js';
import { AdminEmailAlreadyTakenError } from '../domain/errors/domain.error.js';
import { type AdminId, newAdminId } from '../domain/value-objects/admin-id.js';
import type { AdminRepository } from './ports/admin.repository.js';
import { SEED_ADMIN_ID, seedAdmin } from './seed-admin.js';

class FakeAdmins implements AdminRepository {
  readonly byId = new Map<string, Admin>();
  saves = 0;

  findById(id: AdminId): Promise<Admin | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByEmail(email: Email): Promise<Admin | null> {
    const found = [...this.byId.values()].find((admin) => admin.email.equals(email));
    return Promise.resolve(found ?? null);
  }

  save(admin: Admin): Promise<void> {
    const taken = [...this.byId.values()].some(
      (other) => other.id !== admin.id && other.email.equals(admin.email),
    );
    if (taken) {
      return Promise.reject(new AdminEmailAlreadyTakenError(admin.email.value));
    }
    this.byId.set(admin.id, admin);
    this.saves += 1;
    return Promise.resolve();
  }
}

describe('seedAdmin', () => {
  it('creates the seed admin with the fixed id when none exists', async () => {
    const admins = new FakeAdmins();

    expect(await seedAdmin(admins, ' Root@B.co ')).toBe('created');
    expect(admins.byId.get(SEED_ADMIN_ID)?.email.value).toBe('root@b.co');
  });

  it('does nothing when the email is unchanged', async () => {
    const admins = new FakeAdmins();
    await seedAdmin(admins, 'root@b.co');

    expect(await seedAdmin(admins, 'ROOT@b.co')).toBe('unchanged');
    expect(admins.saves).toBe(1);
  });

  it('updates the email of the same admin when the env value changes', async () => {
    const admins = new FakeAdmins();
    await seedAdmin(admins, 'admin@mycompany.io');

    expect(await seedAdmin(admins, 'admin@mycompany.com')).toBe('updated');
    expect(admins.byId.size).toBe(1);
    expect(admins.byId.get(SEED_ADMIN_ID)?.email.value).toBe('admin@mycompany.com');
  });

  it('fails when the new email already belongs to another admin', async () => {
    const admins = new FakeAdmins();
    await seedAdmin(admins, 'root@b.co');
    await admins.save(Admin.create({ id: newAdminId(), email: Email.create('taken@b.co') }));

    await expect(seedAdmin(admins, 'taken@b.co')).rejects.toThrow(AdminEmailAlreadyTakenError);
  });

  it('rejects an invalid email', async () => {
    await expect(seedAdmin(new FakeAdmins(), 'nope')).rejects.toThrow(InvalidEmailError);
  });
});
