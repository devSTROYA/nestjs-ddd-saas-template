import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from '../../../users/infrastructure/persistence/user.schema.js';
import { workspaces } from './workspace.schema.js';

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: varchar('role', { length: 16 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_workspace_members', columns: [table.workspaceId, table.userId] }),
    // Members belong to the workspace aggregate, so they go with it.
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
    index('idx_workspace_members_user_id').on(table.userId),
  ],
);

export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
