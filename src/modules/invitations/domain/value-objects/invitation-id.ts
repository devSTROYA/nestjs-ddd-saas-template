import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type InvitationId = UuidV7Id<'InvitationId'>;
export const InvitationId = uuidV7IdFactory<InvitationId>();
