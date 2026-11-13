import { and, eq } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';

import type { InvitationRepository } from '../../domain/ports/invitation.repository.js';
import type { Invitation } from '../../domain/entities/invitation.js';
import {
  InvitationAlreadyPendingError,
  InvitationNotPendingError,
} from '../../domain/errors/domain.error.js';
import type { InvitationId } from '../../domain/value-objects/invitation-id.js';
import { InvitationStatus } from '../../domain/value-objects/invitation-status.js';
import { toDomain, toMutableColumns, toPersistence } from './invitation.mapper.js';
import { invitations } from './invitation.schema.js';

export class DrizzleInvitationRepository implements InvitationRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findById(id: InvitationId): Promise<Nullable<Invitation>> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(eq(invitations.id, id));
    return row ? toDomain(row) : null;
  }

  async findByIdForUpdate(id: InvitationId): Promise<Nullable<Invitation>> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .for('update');
    return row ? toDomain(row) : null;
  }

  async findPendingByEmail(email: Email): Promise<Nullable<Invitation>> {
    const [row] = await this.context.client
      .select()
      .from(invitations)
      .where(
        and(eq(invitations.email, email.value), eq(invitations.status, InvitationStatus.PENDING)),
      );
    return row ? toDomain(row) : null;
  }

  save(invitation: Invitation): Promise<void> {
    return saveAggregate(this.context, invitation, () => this.write(invitation));
  }

  private async write(invitation: Invitation): Promise<void> {
    try {
      // INFO: Only a pending row may change, so a resend cannot revive an accepted invitation.
      const written = await this.context.client
        .insert(invitations)
        .values(toPersistence(invitation))
        .onConflictDoUpdate({
          target: invitations.id,
          set: { ...toMutableColumns(invitation), updatedAt: new Date() },
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
