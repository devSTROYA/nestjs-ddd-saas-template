import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class AdminId extends UuidV7Id {
  declare private readonly adminIdBrand: true;

  static create(): AdminId {
    return new AdminId(newUuidV7());
  }

  static restore(value: string): AdminId {
    return new AdminId(parseUuidV7(value));
  }
}
