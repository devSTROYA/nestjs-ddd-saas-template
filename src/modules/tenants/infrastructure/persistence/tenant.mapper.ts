import { Tenant } from '../../domain/entities/tenant.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';
import { TenantName } from '../../domain/value-objects/tenant-name.js';
import type { TenantNewRow, TenantRow } from './tenant.schema.js';

export function toDomain(row: TenantRow): Tenant {
  return Tenant.rehydrate(
    { name: TenantName.rehydrate(row.name), createdAt: row.createdAt },
    TenantId.rehydrate(row.id),
  );
}

export function toPersistence(tenant: Tenant): TenantNewRow {
  return { id: tenant.id, name: tenant.name.value, createdAt: tenant.createdAt };
}

// Columns an upsert may overwrite; id and createdAt stay as first written.
export function toMutableColumns(tenant: Tenant): Pick<TenantNewRow, 'name'> {
  return { name: tenant.name.value };
}
