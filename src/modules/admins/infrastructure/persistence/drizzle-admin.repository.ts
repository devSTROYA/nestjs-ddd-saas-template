import { eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import { Email } from '@common/primitives';
import type { Nullable } from '@common/types';

import type { AdminRepository } from '../../domain/ports/admin.repository.js';
import { Admin } from '../../domain/entities/admin.js';
import { AdminEmailAlreadyTakenError } from '../../domain/errors/domain.error.js';
import { AdminId } from '../../domain/value-objects/admin-id.js';
import { toDomain, toMutableColumns, toPersistence } from './admin.mapper.js';
import { admins } from './admin.schema.js';

export class DrizzleAdminRepository implements AdminRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(id: AdminId): Promise<Nullable<Admin>> {
    const [row] = await this.context.client.select().from(admins).where(eq(admins.id, id));
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<Nullable<Admin>> {
    const [row] = await this.context.client
      .select()
      .from(admins)
      .where(eq(admins.email, email.value));
    return row ? toDomain(row) : null;
  }

  async save(admin: Admin): Promise<void> {
    return saveAggregate(this.context, admin, async () => {
      try {
        await this.context.client
          .insert(admins)
          .values(toPersistence(admin))
          .onConflictDoUpdate({
            target: admins.id,
            set: { ...toMutableColumns(admin), updatedAt: new Date() },
          });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AdminEmailAlreadyTakenError(admin.email.value);
        }
        throw error;
      }
    });
  }
}
