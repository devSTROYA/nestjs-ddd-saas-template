import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from '../../../tenants/infrastructure/persistence/tenant.schema.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_users', columns: [table.id] }),
    foreignKey({
      name: 'fk_users_tenant_id',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete('restrict'),
    uniqueIndex('uq_users_email').on(table.email),
    index('idx_users_tenant_id').on(table.tenantId),
  ],
);

export type UserRow = typeof users.$inferSelect;
