import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type TenantId = UuidV7Id<'TenantId'>;
export const TenantId = uuidV7IdFactory<TenantId>();
