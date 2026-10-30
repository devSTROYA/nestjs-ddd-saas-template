import { integer, pgTable, primaryKey, timestamp, varchar } from 'drizzle-orm/pg-core';

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: varchar('key', { length: 128 }).notNull(),
    hits: integer('hits').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ name: 'pk_rate_limits', columns: [table.key] })],
);
