import { RefreshToken } from '../../domain/entities/refresh-token.js';
import { InvalidPrincipalTypeError } from '../../domain/errors/domain.error.js';
import { RefreshTokenId, TokenFamilyId } from '../../domain/value-objects/ids.js';
import { isPrincipalType } from '../../domain/value-objects/principal.js';
import type { RefreshTokenNewRow, RefreshTokenRow } from './refresh-token.schema.js';

export function toDomain(row: RefreshTokenRow): RefreshToken {
  if (!isPrincipalType(row.principalType)) {
    throw new InvalidPrincipalTypeError(row.principalType);
  }
  return RefreshToken.rehydrate(
    {
      familyId: TokenFamilyId.rehydrate(row.familyId),
      principal: {
        type: row.principalType,
        id: row.principalId,
        ...(row.tenantId ? { tenantId: row.tenantId } : {}),
      },
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    },
    RefreshTokenId.rehydrate(row.id),
  );
}

export function toPersistence(token: RefreshToken): RefreshTokenNewRow {
  return {
    id: token.id,
    familyId: token.familyId,
    principalType: token.principal.type,
    principalId: token.principal.id,
    tenantId: token.principal.tenantId ?? null,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    createdAt: token.createdAt,
    ...toMutableColumns(token),
  };
}

// Columns an upsert may overwrite; everything else stays as first written.
export function toMutableColumns(
  token: RefreshToken,
): Pick<RefreshTokenNewRow, 'usedAt' | 'revokedAt'> {
  return { usedAt: token.usedAt, revokedAt: token.revokedAt };
}
