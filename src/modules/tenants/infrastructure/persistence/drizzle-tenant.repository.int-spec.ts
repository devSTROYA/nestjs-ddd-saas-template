import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';

import { Tenant } from '../../domain/entities/tenant.js';
import { TenantEventNames } from '../../domain/events/tenant.events.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { TenantName } from '../../domain/value-objects/tenant-name.js';
import { DrizzleTenantRepository } from './drizzle-tenant.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleTenantRepository(context);

const newTenant = (name = 'Acme') =>
  Tenant.create({ name: TenantName.create(name), createdAt: new Date() });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE tenants, outbox CASCADE');
});

const outboxNames = async (aggregateId: string): Promise<string[]> => {
  const { rows } = await pool.query<{ name: string }>(
    'SELECT name FROM outbox WHERE aggregate_id = $1',
    [aggregateId],
  );
  return rows.map((row) => row.name);
};

afterAll(async () => {
  await pool.end();
});

describe('DrizzleTenantRepository', () => {
  it('saves and reads a tenant back', async () => {
    const tenant = newTenant();
    await repository.save(tenant);

    const found = await repository.findById(tenant.id);

    expect(found?.id).toEqual(tenant.id);
    expect(found?.name.value).toBe('Acme');
    expect(found?.createdAt).toEqual(tenant.createdAt);
  });

  it('writes the tenant events to the outbox when saving', async () => {
    const tenant = newTenant();
    await repository.save(tenant);

    expect(await outboxNames(tenant.id.value)).toEqual([TenantEventNames.CREATED]);
  });

  it('leaves neither the tenant nor its events when the surrounding transaction fails', async () => {
    const tenant = newTenant();

    await expect(
      context.run(async () => {
        await repository.save(tenant);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.findById(tenant.id)).toBeNull();
    expect(await outboxNames(tenant.id.value)).toEqual([]);
  });

  it('returns null when nothing matches', async () => {
    expect(await repository.findById(TenantId.create())).toBeNull();
  });

  it('updates the name when saving an existing tenant', async () => {
    const tenant = newTenant();
    await repository.save(tenant);
    tenant.rename(TenantName.create('Beta'), new Date());
    await repository.save(tenant);

    expect((await repository.findById(tenant.id))?.name.value).toBe('Beta');
  });

  it('rolls back a save made inside a failed transaction', async () => {
    const tenant = newTenant();

    await expect(
      context.run(async () => {
        await repository.save(tenant);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.findById(tenant.id)).toBeNull();
  });
});
