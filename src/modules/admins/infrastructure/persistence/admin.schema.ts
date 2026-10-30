import { pgTable, primaryKey, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const admins = pgTable(
  'admins',
  {
    id: uuid('id').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_admins', columns: [table.id] }),
    uniqueIndex('uq_admins_email').on(table.email),
  ],
);

export type AdminRow = typeof admins.$inferSelect;
