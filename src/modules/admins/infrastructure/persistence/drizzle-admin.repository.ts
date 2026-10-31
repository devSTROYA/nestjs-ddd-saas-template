import { eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import { Email } from '@common/primitives';
import type { Nullable } from '@common/types';

import type { AdminRepository } from '../../application/ports/admin.repository.js';
import { Admin } from '../../domain/entities/admin.js';
import { AdminEmailAlreadyTakenError } from '../../domain/errors/domain.error.js';
import { type AdminId, toAdminId } from '../../domain/value-objects/admin-id.js';
import { type AdminRow, admins } from './admin.schema.js';

function toAdmin(row: AdminRow): Admin {
  return Admin.restore({
    id: toAdminId(row.id),
    email: Email.restore(row.email),
    createdAt: row.createdAt,
  });
}

export class DrizzleAdminRepository implements AdminRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(id: AdminId): Promise<Nullable<Admin>> {
    const [row] = await this.context.client.select().from(admins).where(eq(admins.id, id));
    return row ? toAdmin(row) : null;
  }

  async findByEmail(email: Email): Promise<Nullable<Admin>> {
    const [row] = await this.context.client
      .select()
      .from(admins)
      .where(eq(admins.email, email.value));
    return row ? toAdmin(row) : null;
  }

  async save(admin: Admin): Promise<void> {
    return saveAggregate(this.context, admin, async () => {
      try {
        await this.context.client
          .insert(admins)
          .values({ id: admin.id, email: admin.email.value, createdAt: admin.createdAt })
          .onConflictDoUpdate({
            target: admins.id,
            set: { email: admin.email.value, updatedAt: new Date() },
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
