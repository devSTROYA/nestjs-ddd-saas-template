import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';

import type { Invitation } from '../../domain/entities/invitation.js';
import type { InvitationId } from '../../domain/value-objects/invitation-id.js';

export interface InvitationRepository {
  findById(id: InvitationId): Promise<Nullable<Invitation>>;
  findByIdForUpdate(id: InvitationId): Promise<Nullable<Invitation>>;
  findPendingByEmail(email: Email): Promise<Nullable<Invitation>>;
  save(invitation: Invitation): Promise<void>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
