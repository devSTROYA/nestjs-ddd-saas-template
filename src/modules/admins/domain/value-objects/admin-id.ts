import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type AdminId = UuidV7Id<'AdminId'>;
export const AdminId = uuidV7IdFactory<AdminId>();
