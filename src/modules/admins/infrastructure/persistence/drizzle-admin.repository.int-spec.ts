import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import { Email } from '@common/primitives';

import { SEED_ADMIN_ID, seedAdmin } from '../../application/seed-admin.js';
import { Admin } from '../../domain/entities/admin.js';
import { AdminEmailAlreadyTakenError } from '../../domain/errors/domain.error.js';
import { AdminEventNames } from '../../domain/events/admin.events.js';
import { AdminId } from '../../domain/value-objects/admin-id.js';
import { DrizzleAdminRepository } from './drizzle-admin.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleAdminRepository(context);

const outboxNames = async (aggregateId: string): Promise<string[]> => {
  const { rows } = await pool.query<{ name: string }>(
    'SELECT name FROM outbox WHERE aggregate_id = $1',
    [aggregateId],
  );
  return rows.map((row) => row.name);
};

const NOW = new Date('2026-01-01T00:00:00Z');

const newAdmin = (email = 'root@b.co') =>
  Admin.create({ email: Email.create(email), createdAt: NOW });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE admins, outbox CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleAdminRepository', () => {
  it('saves and reads an admin back by id and by email', async () => {
    const admin = newAdmin();
    await repository.save(admin);

    const byId = await repository.findById(admin.id);
    const byEmail = await repository.findByEmail(admin.email);

    for (const found of [byId, byEmail]) {
      expect(found?.id).toEqual(admin.id);
      expect(found?.email.value).toBe('root@b.co');
      expect(found?.createdAt).toEqual(admin.createdAt);
    }
  });

  it('writes the admin events to the outbox when saving', async () => {
    const admin = newAdmin();
    await repository.save(admin);

    expect(await outboxNames(admin.id.value)).toEqual([AdminEventNames.CREATED]);
  });

  it('leaves neither the admin nor its events when the surrounding transaction fails', async () => {
    const admin = newAdmin();

    await expect(
      context.run(async () => {
        await repository.save(admin);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.findById(admin.id)).toBeNull();
    expect(await outboxNames(admin.id.value)).toEqual([]);
  });

  it('returns null when nothing matches', async () => {
    expect(await repository.findById(AdminId.create())).toBeNull();
    expect(await repository.findByEmail(Email.create('x@y.co'))).toBeNull();
  });

  it('rejects a second admin with the same email', async () => {
    await repository.save(newAdmin());

    await expect(repository.save(newAdmin())).rejects.toThrow(AdminEmailAlreadyTakenError);
  });

  it('updates the email when saving an existing admin', async () => {
    const admin = newAdmin('old@b.co');
    await repository.save(admin);
    admin.changeEmail(Email.create('new@b.co'), NOW);
    await repository.save(admin);

    expect(await repository.findByEmail(Email.create('old@b.co'))).toBeNull();
    expect((await repository.findById(admin.id))?.email.value).toBe('new@b.co');
  });

  it('seeds once, then keeps the same admin when the seed email changes', async () => {
    expect(await seedAdmin(repository, 'admin@mycompany.io', NOW)).toBe('created');
    expect(await seedAdmin(repository, 'admin@mycompany.io', NOW)).toBe('unchanged');
    expect(await seedAdmin(repository, 'admin@mycompany.com', NOW)).toBe('updated');

    const { rows } = await pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM admins',
    );
    expect(rows).toEqual([{ id: SEED_ADMIN_ID.value, email: 'admin@mycompany.com' }]);
  });

  it('refuses to seed an email that belongs to another admin', async () => {
    await seedAdmin(repository, 'root@b.co', NOW);
    await repository.save(newAdmin('taken@b.co'));

    await expect(seedAdmin(repository, 'taken@b.co', NOW)).rejects.toThrow(
      AdminEmailAlreadyTakenError,
    );
  });
});
