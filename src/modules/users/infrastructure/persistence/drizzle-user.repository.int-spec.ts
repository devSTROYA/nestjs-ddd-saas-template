import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';

import { User } from '../../domain/entities/user.js';
import { EmailAlreadyTakenError, UserIdConflictError } from '../../domain/errors/domain.error.js';
import { Email } from '@common/primitives';
import { newTenantId } from '@modules/tenants';
import { UserEventNames } from '../../domain/events/user.events.js';
import { newUserId } from '../../domain/value-objects/user-id.js';
import { UserName } from '../../domain/value-objects/user-name.js';
import { DrizzleUserRepository } from './drizzle-user.repository.js';

const TENANT_A = newTenantId();
const TENANT_B = newTenantId();

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleUserRepository(context);

const newUser = (overrides: { tenantId?: typeof TENANT_A; email?: string } = {}) =>
  User.create({
    id: newUserId(),
    tenantId: overrides.tenantId ?? TENANT_A,
    email: Email.create(overrides.email ?? 'a@b.co'),
    name: UserName.create('Uz'),
  });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE users, tenants, outbox CASCADE');
  await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'A'), ($2, 'B')", [
    TENANT_A,
    TENANT_B,
  ]);
});

afterAll(async () => {
  await pool.end();
});

const outboxNames = async (aggregateId: string): Promise<string[]> => {
  const { rows } = await pool.query<{ name: string }>(
    'SELECT name FROM outbox WHERE aggregate_id = $1',
    [aggregateId],
  );
  return rows.map((row) => row.name);
};

describe('DrizzleUserRepository', () => {
  it('saves and reads a user back by id and by email', async () => {
    const user = newUser();
    await repository.save(user);

    const byId = await repository.findById(TENANT_A, user.id);
    const byEmail = await repository.findByEmail(user.email);

    for (const found of [byId, byEmail]) {
      expect(found?.id).toBe(user.id);
      expect(found?.tenantId).toBe(TENANT_A);
      expect(found?.email.value).toBe('a@b.co');
      expect(found?.name.value).toBe('Uz');
      expect(found?.createdAt).toEqual(user.createdAt);
    }
  });

  it('writes the user events to the outbox when saving', async () => {
    const user = newUser();
    await repository.save(user);

    expect(await outboxNames(user.id)).toEqual([UserEventNames.CREATED]);
  });

  it('leaves neither the user nor its events when the surrounding transaction fails', async () => {
    const user = newUser();

    await expect(
      context.run(async () => {
        await repository.save(user);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.findById(TENANT_A, user.id)).toBeNull();
    expect(await outboxNames(user.id)).toEqual([]);
  });

  it('returns null when nothing matches', async () => {
    expect(await repository.findById(TENANT_A, newUserId())).toBeNull();
    expect(await repository.findByEmail(Email.create('x@y.co'))).toBeNull();
  });

  it('updates the name when saving an existing user', async () => {
    const user = newUser();
    await repository.save(user);
    user.rename(UserName.create('Xy'));
    await repository.save(user);

    expect((await repository.findById(TENANT_A, user.id))?.name.value).toBe('Xy');
  });

  it('does not expose a user to another tenant', async () => {
    const user = newUser();
    await repository.save(user);

    expect(await repository.findById(TENANT_B, user.id)).toBeNull();
  });

  it('rejects a second user with the same email, in the same tenant or another one', async () => {
    await repository.save(newUser());

    await expect(repository.save(newUser())).rejects.toThrow(EmailAlreadyTakenError);
    await expect(repository.save(newUser({ tenantId: TENANT_B }))).rejects.toThrow(
      EmailAlreadyTakenError,
    );
  });

  it('refuses to overwrite a user that belongs to another tenant', async () => {
    const original = newUser();
    await repository.save(original);
    const intruder = User.create({
      id: original.id,
      tenantId: TENANT_B,
      email: Email.create('evil@b.co'),
      name: UserName.create('Evil'),
    });

    await expect(repository.save(intruder)).rejects.toThrow(UserIdConflictError);
    expect((await repository.findById(TENANT_A, original.id))?.name.value).toBe('Uz');
  });

  it('deletes a user of the tenant, frees the email, and ignores another tenant or an unknown id', async () => {
    const user = newUser();
    await repository.save(user);

    await repository.delete(TENANT_B, user.id);
    expect(await repository.findById(TENANT_A, user.id)).not.toBeNull();
    await repository.delete(TENANT_A, newUserId());
    expect(await repository.findByEmail(user.email)).not.toBeNull();

    await repository.delete(TENANT_A, user.id);
    expect(await repository.findById(TENANT_A, user.id)).toBeNull();
    expect(await repository.findByEmail(user.email)).toBeNull();
    const again = newUser({ tenantId: TENANT_B });
    await repository.save(again);
    expect((await repository.findByEmail(again.email))?.id).toBe(again.id);
  });

  it('rejects a user whose tenant does not exist', async () => {
    const orphan = newUser({ tenantId: newTenantId() });

    await expect(repository.save(orphan)).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('restricts deleting a tenant that still has users', async () => {
    await repository.save(newUser());

    await expect(pool.query('DELETE FROM tenants WHERE id = $1', [TENANT_A])).rejects.toMatchObject(
      { code: '23001' },
    );
  });

  describe('transactions', () => {
    it('commits every write made inside run', async () => {
      const first = newUser({ email: 'one@b.co' });
      const second = newUser({ email: 'two@b.co' });

      await context.run(async () => {
        await repository.save(first);
        await repository.save(second);
      });

      expect(await repository.findById(TENANT_A, first.id)).not.toBeNull();
      expect(await repository.findById(TENANT_A, second.id)).not.toBeNull();
    });

    it('rolls back every write when run throws', async () => {
      const user = newUser();

      await expect(
        context.run(async () => {
          await repository.save(user);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await repository.findById(TENANT_A, user.id)).toBeNull();
    });

    it('joins the outer transaction when run is nested', async () => {
      const user = newUser();

      await expect(
        context.run(async () => {
          await context.run(() => repository.save(user));
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await repository.findById(TENANT_A, user.id)).toBeNull();
    });
  });
});
