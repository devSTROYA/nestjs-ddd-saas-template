import { newUuidV7, parseUuidV7 } from '@common/primitives';

declare const adminIdBrand: unique symbol;

export type AdminId = string & { readonly [adminIdBrand]: true };

export function toAdminId(value: string): AdminId {
  return parseUuidV7(value) as AdminId;
}

export function newAdminId(): AdminId {
  return newUuidV7() as AdminId;
}
