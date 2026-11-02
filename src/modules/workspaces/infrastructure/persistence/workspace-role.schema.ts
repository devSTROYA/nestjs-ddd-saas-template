import { sql } from 'drizzle-orm';
import {
  check,
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
import { workspaces } from './workspace.schema.js';

// INFO: tenant_id and workspace_id are both null on a system role, which every workspace shares.
export const workspaceRoles = pgTable(
  'workspace_roles',
  {
    id: uuid('id').notNull(),
    tenantId: uuid('tenant_id'),
    workspaceId: uuid('workspace_id'),
    key: varchar('key', { length: 32 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_workspace_roles', columns: [table.id] }),
    foreignKey({
      name: 'fk_workspace_roles_tenant_id',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'fk_workspace_roles_workspace_id',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('cascade'),
    check(
      'ck_workspace_roles_scope',
      sql`(${table.tenantId} is null) = (${table.workspaceId} is null)`,
    ),
    uniqueIndex('uq_workspace_roles_workspace_id_key').on(table.workspaceId, table.key),
    // INFO: A unique index treats nulls as distinct, so system roles need their own.
    uniqueIndex('uq_workspace_roles_key_system')
      .on(table.key)
      .where(sql`${table.workspaceId} is null`),
    index('idx_workspace_roles_tenant_id').on(table.tenantId),
  ],
);

export const workspaceRolePermissions = pgTable(
  'workspace_role_permissions',
  {
    roleId: uuid('role_id').notNull(),
    permission: varchar('permission', { length: 64 }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'pk_workspace_role_permissions',
      columns: [table.roleId, table.permission],
    }),
    foreignKey({
      name: 'fk_workspace_role_permissions_role_id',
      columns: [table.roleId],
      foreignColumns: [workspaceRoles.id],
    }).onDelete('cascade'),
  ],
);

export type WorkspaceRoleRow = typeof workspaceRoles.$inferSelect;
