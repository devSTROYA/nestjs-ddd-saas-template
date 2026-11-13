import { Email } from '@common/primitives';

import { Admin } from '../../domain/entities/admin.js';
import { AdminId } from '../../domain/value-objects/admin-id.js';
import type { AdminNewRow, AdminRow } from './admin.schema.js';

export function toDomain(row: AdminRow): Admin {
  return Admin.rehydrate(
    { email: Email.rehydrate(row.email), createdAt: row.createdAt },
    AdminId.rehydrate(row.id),
  );
}

export function toPersistence(admin: Admin): AdminNewRow {
  return { id: admin.id, email: admin.email.value, createdAt: admin.createdAt };
}

// Columns an upsert may overwrite; id and createdAt stay as first written.
export function toMutableColumns(admin: Admin): Pick<AdminNewRow, 'email'> {
  return { email: admin.email.value };
}
