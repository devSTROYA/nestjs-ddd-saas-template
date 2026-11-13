import { and, eq, isNull } from 'drizzle-orm';

import type { DatabaseContext } from '@common/database';
import { appendEvents, saveAggregate } from '@common/outbox';
import type { Nullable } from '@common/types';

import type { RefreshTokenRepository } from '../../domain/ports/refresh-token.repository.js';
import type { RefreshToken } from '../../domain/entities/refresh-token.js';
import { RefreshTokenFamilyRevokedEvent } from '../../domain/events/refresh-token.events.js';
import type { TokenFamilyId } from '../../domain/value-objects/ids.js';
import { toDomain, toMutableColumns, toPersistence } from './refresh-token.mapper.js';
import { refreshTokens } from './refresh-token.schema.js';

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findByHashForUpdate(tokenHash: string): Promise<Nullable<RefreshToken>> {
    const [row] = await this.context.client
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update');
    return row ? toDomain(row) : null;
  }

  save(token: RefreshToken): Promise<void> {
    return saveAggregate(this.context, token, async () => {
      await this.context.client
        .insert(refreshTokens)
        .values(toPersistence(token))
        .onConflictDoUpdate({ target: refreshTokens.id, set: toMutableColumns(token) });
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
        new RefreshTokenFamilyRevokedEvent({
          aggregateId: familyId,
          tenantId: null,
          occurredAt: now.toISOString(),
          revokedTokens: revoked.length,
        }),
      ]);
    });
  }
}
