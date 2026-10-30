import { newUuidV7, parseUuidV7 } from '@common/primitives';

declare const invitationIdBrand: unique symbol;

export type InvitationId = string & { readonly [invitationIdBrand]: true };

export function toInvitationId(value: string): InvitationId {
  return parseUuidV7(value) as InvitationId;
}

export function newInvitationId(): InvitationId {
  return newUuidV7() as InvitationId;
}
