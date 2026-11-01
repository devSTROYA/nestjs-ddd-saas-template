import type { User } from '../../domain/entities/user.js';
import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '../../domain/value-objects/user-id.js';

export interface UserRepository {
  findById(tenantId: TenantId, id: UserId): Promise<Nullable<User>>;
  // INFO: Emails are unique across all tenants, so no tenant is needed to look one up.
  findByEmail(email: Email): Promise<Nullable<User>>;
  save(user: User): Promise<void>;
  delete(tenantId: TenantId, id: UserId): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
