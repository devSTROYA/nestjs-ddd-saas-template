import type { Tenant } from '../../domain/entities/tenant.js';
import type { TenantId } from '../../domain/value-objects/tenant-id.js';

export interface TenantRepository {
  findById(id: TenantId): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
}

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');
