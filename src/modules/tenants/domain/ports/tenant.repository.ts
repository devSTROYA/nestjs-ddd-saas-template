import type { Nullable } from '@common/types';

import type { Tenant } from '../entities/tenant.js';
import type { TenantId } from '../value-objects/tenant-id.js';

export interface TenantRepository {
  findById(id: TenantId): Promise<Nullable<Tenant>>;
  save(tenant: Tenant): Promise<void>;
}

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');
