import { and, eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import { AdminId } from '@modules/admins';

import type { InvitationRepository } from '../../application/ports/invitation.repository.js';
import { Invitation } from '../../domain/entities/invitation.js';
import {
  InvalidInvitationStatusError,
  InvitationAlreadyPendingError,
  InvitationNotPendingError,
} from '../../domain/errors/domain.error.js';
import { InvitationId } from '../../domain/value-objects/invitation-id.js';
import {
  InvitationStatus,
  isInvitationStatus,
} from '../../domain/value-objects/invitation-status.js';
import { type InvitationRow, invitations } from './invitation.schema.js';

function toInvitation(row: InvitationRow): Invitation {
  if (!isInvitationStatus(row.status)) {
    throw new InvalidInvitationStatusError(row.status);
  }
  return Invitation.restore(
    {
      email: Email.restore(row.email),
      invitedBy: AdminId.restore(row.invitedBy),
      otpHash: row.otpHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      status: row.status,
      createdAt: row.createdAt,
    },
    InvitationId.restore(row.id),
  );
}

export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(id: InvitationId): Promise<Nullable<Invitation>> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(eq(invitations.id, id.value));
    return row ? toInvitation(row) : null;
  }

  async findByIdForUpdate(id: InvitationId): Promise<Nullable<Invitation>> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(eq(invitations.id, id.value))
      .for('update');
    return row ? toInvitation(row) : null;
  }

  async findPendingByEmail(email: Email): Promise<Nullable<Invitation>> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(
        and(eq(invitations.email, email.value), eq(invitations.status, InvitationStatus.PENDING)),
      );
    return row ? toInvitation(row) : null;
  }

  save(invitation: Invitation): Promise<void> {
    return saveAggregate(this.context, invitation, () => this.write(invitation));
  }

  private async write(invitation: Invitation): Promise<void> {
    const mutable = {
      otpHash: invitation.otpHash,
      expiresAt: invitation.expiresAt,
      attempts: invitation.attempts,
      status: invitation.status,
    };
    try {
      // INFO: Only a pending row may change, so a resend cannot revive an accepted invitation.
      const written = await this.context.client
        .insert(invitations)
        .values({
          id: invitation.id.value,
          email: invitation.email.value,
          invitedBy: invitation.invitedBy.value,
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
