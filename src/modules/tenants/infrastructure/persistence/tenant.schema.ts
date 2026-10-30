import { pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ name: 'pk_tenants', columns: [table.id] })],
);

export type TenantRow = typeof tenants.$inferSelect;
