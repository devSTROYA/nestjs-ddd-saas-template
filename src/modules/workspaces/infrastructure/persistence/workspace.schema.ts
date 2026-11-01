import {
  foreignKey,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from '../../../tenants/infrastructure/persistence/tenant.schema.js';

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_workspaces', columns: [table.id] }),
    foreignKey({
      name: 'fk_workspaces_tenant_id',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete('restrict'),
    // INFO: One workspace per tenant for now; drop this index to allow several.
    uniqueIndex('uq_workspaces_tenant_id').on(table.tenantId),
  ],
);

export type WorkspaceRow = typeof workspaces.$inferSelect;
