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

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').notNull(),
    familyId: uuid('family_id').notNull(),
    principalType: varchar('principal_type', { length: 16 }).notNull(),
    principalId: uuid('principal_id').notNull(),
    tenantId: uuid('tenant_id'),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_refresh_tokens', columns: [table.id] }),
    foreignKey({
      name: 'fk_refresh_tokens_tenant_id',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete('restrict'),
    uniqueIndex('uq_refresh_tokens_token_hash').on(table.tokenHash),
    index('idx_refresh_tokens_family_id').on(table.familyId),
    index('idx_refresh_tokens_tenant_id').on(table.tenantId),
  ],
);

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
