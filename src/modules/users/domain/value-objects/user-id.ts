import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type UserId = UuidV7Id<'UserId'>;
export const UserId = uuidV7IdFactory<UserId>();
