import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    tenantId: uuid('tenant_id'),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: varchar('last_error', { length: 1000 }),
  },
  (table) => [
    primaryKey({ name: 'pk_outbox', columns: [table.id] }),
    index('idx_outbox_pending')
      .on(table.id)
      .where(sql`${table.processedAt} is null`),
  ],
);

export type OutboxRow = typeof outbox.$inferSelect;
