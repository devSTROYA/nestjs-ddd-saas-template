export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export function isInvitationStatus(value: string): value is InvitationStatus {
  return Object.values<string>(InvitationStatus).includes(value);
}
