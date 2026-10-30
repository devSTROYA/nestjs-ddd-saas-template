import { eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';

import type { TenantRepository } from '../../application/ports/tenant.repository.js';
import { Tenant } from '../../domain/entities/tenant.js';
import { type TenantId, toTenantId } from '../../domain/value-objects/tenant-id.js';
import { TenantName } from '../../domain/value-objects/tenant-name.js';
import { type TenantRow, tenants } from './tenant.schema.js';

function toTenant(row: TenantRow): Tenant {
  return Tenant.restore({
    id: toTenantId(row.id),
    name: TenantName.restore(row.name),
    createdAt: row.createdAt,
  });
}

export class DrizzleTenantRepository implements TenantRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(id: TenantId): Promise<Tenant | null> {
    const [row] = await this.context.client.select().from(tenants).where(eq(tenants.id, id));
    return row ? toTenant(row) : null;
  }

  async save(tenant: Tenant): Promise<void> {
    const name = tenant.name.value;
    await this.context.client
      .insert(tenants)
      .values({ id: tenant.id, name, createdAt: tenant.createdAt })
      .onConflictDoUpdate({ target: tenants.id, set: { name, updatedAt: new Date() } });
  }
}
