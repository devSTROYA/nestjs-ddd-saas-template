import { InvalidInvitationStatusError } from '../errors/domain.error.js';

export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

// Fails fast: an unknown stored value throws instead of becoming a status.
export function parseInvitationStatus(value: string): InvitationStatus {
  const status = Object.values(InvitationStatus).find((candidate) => candidate === value);
  if (!status) {
    throw new InvalidInvitationStatusError(value);
  }
  return status;
}
