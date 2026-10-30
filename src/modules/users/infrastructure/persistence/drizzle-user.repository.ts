import { and, eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';

import type { UserRepository } from '../../application/ports/user.repository.js';
import { User } from '../../domain/entities/user.js';
import { EmailAlreadyTakenError, UserIdConflictError } from '../../domain/errors/domain.error.js';
import { Email } from '@common/primitives';
import { type TenantId, toTenantId } from '@modules/tenants';
import { type UserId, toUserId } from '../../domain/value-objects/user-id.js';
import { UserName } from '../../domain/value-objects/user-name.js';
import { type UserRow, users } from './user.schema.js';

function toUser(row: UserRow): User {
  return User.restore({
    id: toUserId(row.id),
    tenantId: toTenantId(row.tenantId),
    email: Email.restore(row.email),
    name: UserName.restore(row.name),
    createdAt: row.createdAt,
  });
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(tenantId: TenantId, id: UserId): Promise<User | null> {
    const [row] = await this.context.client
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)));
    return row ? toUser(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const [row] = await this.context.client
      .select()
      .from(users)
      .where(eq(users.email, email.value));
    return row ? toUser(row) : null;
  }

  async delete(tenantId: TenantId, id: UserId): Promise<void> {
    await this.context.client
      .delete(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)));
  }

  async save(user: User): Promise<void> {
    const name = user.name.value;
    try {
      const written = await this.context.client
        .insert(users)
        .values({
          id: user.id,
          tenantId: user.tenantId,
          email: user.email.value,
          name,
          createdAt: user.createdAt,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { name, updatedAt: new Date() },
          setWhere: eq(users.tenantId, user.tenantId),
        })
        .returning({ id: users.id });
      if (written.length === 0) {
        throw new UserIdConflictError(user.id);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EmailAlreadyTakenError(user.email.value);
      }
      throw error;
    }
  }
}
