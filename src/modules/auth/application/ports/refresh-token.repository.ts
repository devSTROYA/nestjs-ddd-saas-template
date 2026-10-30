import type { RefreshToken } from '../../domain/entities/refresh-token.js';
import type { TokenFamilyId } from '../../domain/value-objects/ids.js';

export interface RefreshTokenRepository {
  findByHashForUpdate(tokenHash: string): Promise<RefreshToken | null>;
  save(token: RefreshToken): Promise<void>;
  revokeFamily(familyId: TokenFamilyId, now: Date): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
