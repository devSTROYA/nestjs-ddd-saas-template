import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class TenantId extends UuidV7Id {
  declare private readonly tenantIdBrand: true;

  static create(): TenantId {
    return new TenantId(newUuidV7());
  }

  static restore(value: string): TenantId {
    return new TenantId(parseUuidV7(value));
  }
}
