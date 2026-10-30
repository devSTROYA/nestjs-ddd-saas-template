import { newUuidV7, parseUuidV7 } from '@common/primitives';

declare const userIdBrand: unique symbol;

export type UserId = string & { readonly [userIdBrand]: true };

export function toUserId(value: string): UserId {
  return parseUuidV7(value) as UserId;
}

export function newUserId(): UserId {
  return newUuidV7() as UserId;
}
