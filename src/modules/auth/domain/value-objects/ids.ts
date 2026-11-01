import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class LoginChallengeId extends UuidV7Id {
  declare private readonly loginChallengeIdBrand: true;

  static create(): LoginChallengeId {
    return new LoginChallengeId(newUuidV7());
  }

  static restore(value: string): LoginChallengeId {
    return new LoginChallengeId(parseUuidV7(value));
  }
}

export class RefreshTokenId extends UuidV7Id {
  declare private readonly refreshTokenIdBrand: true;

  static create(): RefreshTokenId {
    return new RefreshTokenId(newUuidV7());
  }

  static restore(value: string): RefreshTokenId {
    return new RefreshTokenId(parseUuidV7(value));
  }
}

export class TokenFamilyId extends UuidV7Id {
  declare private readonly tokenFamilyIdBrand: true;

  static create(): TokenFamilyId {
    return new TokenFamilyId(newUuidV7());
  }

  static restore(value: string): TokenFamilyId {
    return new TokenFamilyId(parseUuidV7(value));
  }
}
