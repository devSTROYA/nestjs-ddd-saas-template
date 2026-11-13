import { and, eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';

import type { UserRepository } from '../../domain/ports/user.repository.js';
import { User } from '../../domain/entities/user.js';
import { EmailAlreadyTakenError, UserIdConflictError } from '../../domain/errors/domain.error.js';
import { saveAggregate } from '@common/outbox';
import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';
import type { UserId } from '../../domain/value-objects/user-id.js';
import { toDomain, toMutableColumns, toPersistence } from './user.mapper.js';
import { users } from './user.schema.js';

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(tenantId: TenantId, id: UserId): Promise<Nullable<User>> {
    const [row] = await this.context.client
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)));
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<Nullable<User>> {
    const [row] = await this.context.client
      .select()
      .from(users)
      .where(eq(users.email, email.value));
    return row ? toDomain(row) : null;
  }

  async delete(tenantId: TenantId, id: UserId): Promise<void> {
    await this.context.client
      .delete(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)));
  }

  async save(user: User): Promise<void> {
    return saveAggregate(this.context, user, async () => {
      try {
        const written = await this.context.client
          .insert(users)
          .values(toPersistence(user))
          .onConflictDoUpdate({
            target: users.id,
            set: { ...toMutableColumns(user), updatedAt: new Date() },
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
    });
  }
}
