import type { Email } from '@common/primitives';

import type { Invitation } from '../../domain/entities/invitation.js';
import type { InvitationId } from '../../domain/value-objects/invitation-id.js';

export interface InvitationRepository {
  findById(id: InvitationId): Promise<Invitation | null>;
  findByIdForUpdate(id: InvitationId): Promise<Invitation | null>;
  findPendingByEmail(email: Email): Promise<Invitation | null>;
  save(invitation: Invitation): Promise<void>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
