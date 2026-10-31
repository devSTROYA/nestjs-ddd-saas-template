import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';

import type { Admin } from '../../domain/entities/admin.js';
import type { AdminId } from '../../domain/value-objects/admin-id.js';

export interface AdminRepository {
  findById(id: AdminId): Promise<Nullable<Admin>>;
  findByEmail(email: Email): Promise<Nullable<Admin>>;
  save(admin: Admin): Promise<void>;
}

export const ADMIN_REPOSITORY = Symbol('ADMIN_REPOSITORY');
