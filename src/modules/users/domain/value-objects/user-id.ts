import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class UserId extends UuidV7Id {
  declare private readonly userIdBrand: true;

  static create(): UserId {
    return new UserId(newUuidV7());
  }

  static restore(value: string): UserId {
    return new UserId(parseUuidV7(value));
  }
}
