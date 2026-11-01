import { and, eq, isNull } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import { appendEvents, saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';

import type { RefreshTokenRepository } from '../../application/ports/refresh-token.repository.js';
import { RefreshToken } from '../../domain/entities/refresh-token.js';
import { InvalidPrincipalTypeError } from '../../domain/errors/domain.error.js';
import { RefreshTokenFamilyRevokedEvent } from '../../domain/events/refresh-token.events.js';
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
  return RefreshToken.restore(
    {
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
    },
    toRefreshTokenId(row.id),
  );
}

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findByHashForUpdate(tokenHash: string): Promise<Nullable<RefreshToken>> {
    const [row] = await this.context.client
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update');
    return row ? toToken(row) : null;
  }

  save(token: RefreshToken): Promise<void> {
    return saveAggregate(this.context, token, async () => {
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
    });
  }

  revokeFamily(familyId: TokenFamilyId, now: Date): Promise<void> {
    return this.context.run(async () => {
      const revoked = await this.context.client
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });
      if (revoked.length === 0) {
        return;
      }
      await appendEvents(this.context, [
        new RefreshTokenFamilyRevokedEvent(familyId, now.toISOString(), revoked.length),
      ]);
    });
  }
}
