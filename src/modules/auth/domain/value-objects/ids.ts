import { newUuidV7, parseUuidV7 } from '@common/primitives';

declare const loginChallengeIdBrand: unique symbol;
declare const refreshTokenIdBrand: unique symbol;
declare const tokenFamilyIdBrand: unique symbol;

export type LoginChallengeId = string & { readonly [loginChallengeIdBrand]: true };
export type RefreshTokenId = string & { readonly [refreshTokenIdBrand]: true };
export type TokenFamilyId = string & { readonly [tokenFamilyIdBrand]: true };

export const toLoginChallengeId = (value: string): LoginChallengeId =>
  parseUuidV7(value) as LoginChallengeId;
export const newLoginChallengeId = (): LoginChallengeId => newUuidV7() as LoginChallengeId;

export const toRefreshTokenId = (value: string): RefreshTokenId =>
  parseUuidV7(value) as RefreshTokenId;
export const newRefreshTokenId = (): RefreshTokenId => newUuidV7() as RefreshTokenId;

export const toTokenFamilyId = (value: string): TokenFamilyId =>
  parseUuidV7(value) as TokenFamilyId;
export const newTokenFamilyId = (): TokenFamilyId => newUuidV7() as TokenFamilyId;
