import { newUuidV7, parseUuidV7 } from '@common/primitives';

declare const tenantIdBrand: unique symbol;

export type TenantId = string & { readonly [tenantIdBrand]: true };

export function toTenantId(value: string): TenantId {
  return parseUuidV7(value) as TenantId;
}

export function newTenantId(): TenantId {
  return newUuidV7() as TenantId;
}
