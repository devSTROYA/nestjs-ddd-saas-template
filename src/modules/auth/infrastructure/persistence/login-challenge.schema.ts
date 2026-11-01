import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from '../../../tenants/infrastructure/persistence/tenant.schema.js';
import { LoginChallengeStatus } from '../../domain/value-objects/login-challenge-status.js';

const pending = (status: unknown) =>
  sql`${status} = ${sql.raw(`'${LoginChallengeStatus.PENDING}'`)}`;

export const loginChallenges = pgTable(
  'login_challenges',
  {
    id: uuid('id').notNull(),
    tenantId: uuid('tenant_id'),
    email: varchar('email', { length: 320 }).notNull(),
    otpHash: varchar('otp_hash', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    status: varchar('status', { length: 16 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_login_challenges', columns: [table.id] }),
    foreignKey({
      name: 'fk_login_challenges_tenant_id',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete('restrict'),
    uniqueIndex('uq_login_challenges_email_pending')
      .on(table.email)
      .where(sql`${pending(table.status)} and ${table.tenantId} is null`),
    uniqueIndex('uq_login_challenges_tenant_id_email_pending')
      .on(table.tenantId, table.email)
      .where(sql`${pending(table.status)} and ${table.tenantId} is not null`),
    index('idx_login_challenges_tenant_id').on(table.tenantId),
  ],
);

export type LoginChallengeRow = typeof loginChallenges.$inferSelect;
