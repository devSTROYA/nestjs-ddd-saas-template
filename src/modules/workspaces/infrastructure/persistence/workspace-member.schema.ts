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
import { users } from '../../../users/infrastructure/persistence/user.schema.js';
import { workspaces } from './workspace.schema.js';

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: varchar('role', { length: 16 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_workspace_members', columns: [table.id] }),
    foreignKey({
      name: 'fk_workspace_members_tenant_id',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'fk_workspace_members_workspace_id',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'fk_workspace_members_user_id',
      columns: [table.userId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
    uniqueIndex('uq_workspace_members_workspace_id_user_id').on(table.workspaceId, table.userId),
    index('idx_workspace_members_tenant_id').on(table.tenantId),
    index('idx_workspace_members_user_id').on(table.userId),
  ],
);

export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
