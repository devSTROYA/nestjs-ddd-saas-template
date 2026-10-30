import { and, eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { Email } from '@common/primitives';
import { toAdminId } from '@modules/admins';

import type { InvitationRepository } from '../../application/ports/invitation.repository.js';
import { Invitation } from '../../domain/entities/invitation.js';
import {
  InvalidInvitationStatusError,
  InvitationAlreadyPendingError,
  InvitationNotPendingError,
} from '../../domain/errors/domain.error.js';
import { type InvitationId, toInvitationId } from '../../domain/value-objects/invitation-id.js';
import {
  InvitationStatus,
  isInvitationStatus,
} from '../../domain/value-objects/invitation-status.js';
import { type InvitationRow, invitations } from './invitation.schema.js';

function toInvitation(row: InvitationRow): Invitation {
  if (!isInvitationStatus(row.status)) {
    throw new InvalidInvitationStatusError(row.status);
  }
  return Invitation.restore({
    id: toInvitationId(row.id),
    email: Email.restore(row.email),
    invitedBy: toAdminId(row.invitedBy),
    otpHash: row.otpHash,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    status: row.status,
    createdAt: row.createdAt,
  });
}

export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(id: InvitationId): Promise<Invitation | null> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(eq(invitations.id, id));
    return row ? toInvitation(row) : null;
  }

  async findByIdForUpdate(id: InvitationId): Promise<Invitation | null> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .for('update');
    return row ? toInvitation(row) : null;
  }

  async findPendingByEmail(email: Email): Promise<Invitation | null> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(
        and(eq(invitations.email, email.value), eq(invitations.status, InvitationStatus.PENDING)),
      );
    return row ? toInvitation(row) : null;
  }

  async save(invitation: Invitation): Promise<void> {
    const mutable = {
      otpHash: invitation.otpHash,
      expiresAt: invitation.expiresAt,
      attempts: invitation.attempts,
      status: invitation.status,
    };
    try {
      // Only a pending row may change, so a resend cannot revive an invitation accepted meanwhile.
      const written = await this.context.client
        .insert(invitations)
        .values({
          id: invitation.id,
          email: invitation.email.value,
          invitedBy: invitation.invitedBy,
          createdAt: invitation.createdAt,
          ...mutable,
        })
        .onConflictDoUpdate({
          target: invitations.id,
          set: { ...mutable, updatedAt: new Date() },
          setWhere: eq(invitations.status, InvitationStatus.PENDING),
        })
        .returning({ id: invitations.id });
      if (written.length === 0) {
        throw new InvitationNotPendingError('changed concurrently');
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new InvitationAlreadyPendingError(invitation.email.value);
      }
      throw error;
    }
  }
}
