import { Email } from '@common/primitives';
import { TenantId } from '@modules/tenants';

import { User } from '../../domain/entities/user.js';
import { UserId } from '../../domain/value-objects/user-id.js';
import { UserName } from '../../domain/value-objects/user-name.js';
import type { UserNewRow, UserRow } from './user.schema.js';

export function toDomain(row: UserRow): User {
  return User.rehydrate(
    {
      tenantId: TenantId.rehydrate(row.tenantId),
      email: Email.rehydrate(row.email),
      name: UserName.rehydrate(row.name),
      createdAt: row.createdAt,
    },
    UserId.rehydrate(row.id),
  );
}

export function toPersistence(user: User): UserNewRow {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email.value,
    name: user.name.value,
    createdAt: user.createdAt,
  };
}

// Columns an upsert may overwrite; id, tenant, email and createdAt stay as first written.
export function toMutableColumns(user: User): Pick<UserNewRow, 'name'> {
  return { name: user.name.value };
}
