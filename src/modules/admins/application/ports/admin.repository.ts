import type { Email } from '@common/primitives';

import type { Admin } from '../../domain/entities/admin.js';
import type { AdminId } from '../../domain/value-objects/admin-id.js';

export interface AdminRepository {
  findById(id: AdminId): Promise<Admin | null>;
  findByEmail(email: Email): Promise<Admin | null>;
  save(admin: Admin): Promise<void>;
}

export const ADMIN_REPOSITORY = Symbol('ADMIN_REPOSITORY');
