import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type LoginChallengeId = UuidV7Id<'LoginChallengeId'>;
export const LoginChallengeId = uuidV7IdFactory<LoginChallengeId>();

export type RefreshTokenId = UuidV7Id<'RefreshTokenId'>;
export const RefreshTokenId = uuidV7IdFactory<RefreshTokenId>();

export type TokenFamilyId = UuidV7Id<'TokenFamilyId'>;
export const TokenFamilyId = uuidV7IdFactory<TokenFamilyId>();
