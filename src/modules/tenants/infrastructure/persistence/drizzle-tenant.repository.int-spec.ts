import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';

import { Tenant } from '../../domain/entities/tenant.js';
import { newTenantId } from '../../domain/value-objects/tenant-id.js';
import { TenantName } from '../../domain/value-objects/tenant-name.js';
import { DrizzleTenantRepository } from './drizzle-tenant.repository.js';

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleTenantRepository(context);

const newTenant = (name = 'Acme') =>
  Tenant.create({ id: newTenantId(), name: TenantName.create(name) });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE tenants CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleTenantRepository', () => {
  it('saves and reads a tenant back', async () => {
    const tenant = newTenant();
    await repository.save(tenant);

    const found = await repository.findById(tenant.id);

    expect(found?.id).toBe(tenant.id);
    expect(found?.name.value).toBe('Acme');
    expect(found?.createdAt).toEqual(tenant.createdAt);
  });

  it('returns null when nothing matches', async () => {
    expect(await repository.findById(newTenantId())).toBeNull();
  });

  it('updates the name when saving an existing tenant', async () => {
    const tenant = newTenant();
    await repository.save(tenant);
    tenant.rename(TenantName.create('Beta'));
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
