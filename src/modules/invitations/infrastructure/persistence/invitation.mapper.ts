import { Email } from '@common/primitives';
import { AdminId } from '@modules/admins';

import { Invitation } from '../../domain/entities/invitation.js';
import { InvalidInvitationStatusError } from '../../domain/errors/domain.error.js';
import { InvitationId } from '../../domain/value-objects/invitation-id.js';
import { isInvitationStatus } from '../../domain/value-objects/invitation-status.js';
import type { InvitationNewRow, InvitationRow } from './invitation.schema.js';

export function toDomain(row: InvitationRow): Invitation {
  if (!isInvitationStatus(row.status)) {
    throw new InvalidInvitationStatusError(row.status);
  }
  return Invitation.rehydrate(
    {
      email: Email.rehydrate(row.email),
      invitedBy: AdminId.rehydrate(row.invitedBy),
      otpHash: row.otpHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      status: row.status,
      createdAt: row.createdAt,
    },
    InvitationId.rehydrate(row.id),
  );
}

export function toPersistence(invitation: Invitation): InvitationNewRow {
  return {
    id: invitation.id,
    email: invitation.email.value,
    invitedBy: invitation.invitedBy,
    createdAt: invitation.createdAt,
    ...toMutableColumns(invitation),
  };
}

// Columns an upsert may overwrite; id, email, inviter and createdAt stay as first written.
export function toMutableColumns(
  invitation: Invitation,
): Pick<InvitationNewRow, 'otpHash' | 'expiresAt' | 'attempts' | 'status'> {
  return {
    otpHash: invitation.otpHash,
    expiresAt: invitation.expiresAt,
    attempts: invitation.attempts,
    status: invitation.status,
  };
}
