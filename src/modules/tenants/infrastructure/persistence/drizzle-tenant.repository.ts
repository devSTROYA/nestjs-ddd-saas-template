import { eq } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';

import type { TenantRepository } from '../../domain/ports/tenant.repository.js';
import { Tenant } from '../../domain/entities/tenant.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { toDomain, toMutableColumns, toPersistence } from './tenant.mapper.js';
import { tenants } from './tenant.schema.js';

export class DrizzleTenantRepository implements TenantRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(id: TenantId): Promise<Nullable<Tenant>> {
    const [row] = await this.context.client.select().from(tenants).where(eq(tenants.id, id));
    return row ? toDomain(row) : null;
  }

  async save(tenant: Tenant): Promise<void> {
    return saveAggregate(this.context, tenant, async () => {
      await this.context.client
        .insert(tenants)
        .values(toPersistence(tenant))
        .onConflictDoUpdate({
          target: tenants.id,
          set: { ...toMutableColumns(tenant), updatedAt: new Date() },
        });
    });
  }
}
