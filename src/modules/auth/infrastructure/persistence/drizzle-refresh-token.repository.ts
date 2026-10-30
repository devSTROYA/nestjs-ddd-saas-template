import { and, eq, isNull } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';

import type { RefreshTokenRepository } from '../../application/ports/refresh-token.repository.js';
import { RefreshToken } from '../../domain/entities/refresh-token.js';
import { InvalidPrincipalTypeError } from '../../domain/errors/domain.error.js';
import {
  type TokenFamilyId,
  toRefreshTokenId,
  toTokenFamilyId,
} from '../../domain/value-objects/ids.js';
import { isPrincipalType } from '../../domain/value-objects/principal.js';
import { type RefreshTokenRow, refreshTokens } from './refresh-token.schema.js';

function toToken(row: RefreshTokenRow): RefreshToken {
  if (!isPrincipalType(row.principalType)) {
    throw new InvalidPrincipalTypeError(row.principalType);
  }
  return RefreshToken.restore({
    id: toRefreshTokenId(row.id),
    familyId: toTokenFamilyId(row.familyId),
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
  });
}

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findByHashForUpdate(tokenHash: string): Promise<RefreshToken | null> {
    const [row] = await this.context.client
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update');
    return row ? toToken(row) : null;
  }

  async save(token: RefreshToken): Promise<void> {
    const mutable = { usedAt: token.usedAt, revokedAt: token.revokedAt };
    await this.context.client
      .insert(refreshTokens)
      .values({
        id: token.id,
        familyId: token.familyId,
        principalType: token.principal.type,
        principalId: token.principal.id,
        tenantId: token.principal.tenantId ?? null,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        ...mutable,
      })
      .onConflictDoUpdate({ target: refreshTokens.id, set: mutable });
  }

  async revokeFamily(familyId: TokenFamilyId, now: Date): Promise<void> {
    await this.context.client
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }
}
