import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { admins } from '../../../admins/infrastructure/persistence/admin.schema.js';
import { InvitationStatus } from '../../domain/value-objects/invitation-status.js';

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    invitedBy: uuid('invited_by').notNull(),
    otpHash: varchar('otp_hash', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    status: varchar('status', { length: 16 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_invitations', columns: [table.id] }),
    foreignKey({
      name: 'fk_invitations_invited_by',
      columns: [table.invitedBy],
      foreignColumns: [admins.id],
    }).onDelete('restrict'),
    index('idx_invitations_invited_by').on(table.invitedBy),
    uniqueIndex('uq_invitations_email_pending')
      .on(table.email)
      .where(sql`${table.status} = ${sql.raw(`'${InvitationStatus.PENDING}'`)}`),
  ],
);

export type InvitationRow = typeof invitations.$inferSelect;
