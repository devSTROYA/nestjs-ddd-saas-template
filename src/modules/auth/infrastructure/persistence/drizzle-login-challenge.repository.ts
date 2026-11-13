import { and, eq, isNull } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import type { LoginChallengeRepository } from '../../domain/ports/login-challenge.repository.js';
import type { LoginChallenge } from '../../domain/entities/login-challenge.js';
import { LoginChallengeAlreadyPendingError } from '../../domain/errors/domain.error.js';
import { LoginChallengeStatus } from '../../domain/value-objects/login-challenge-status.js';
import { toDomain, toMutableColumns, toPersistence } from './login-challenge.mapper.js';
import { loginChallenges } from './login-challenge.schema.js';

export class DrizzleLoginChallengeRepository implements LoginChallengeRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findPendingByEmail(
    email: Email,
    tenantId: Nullable<TenantId>,
  ): Promise<Nullable<LoginChallenge>> {
    const [row] = await this.context.client
      .select()
      .from(loginChallenges)
      .where(this.pendingFor(email, tenantId));
    return row ? toDomain(row) : null;
  }

  async findPendingByEmailForUpdate(
    email: Email,
    tenantId: Nullable<TenantId>,
  ): Promise<Nullable<LoginChallenge>> {
    const [row] = await this.context.client
      .select()
      .from(loginChallenges)
      .where(this.pendingFor(email, tenantId))
      .for('update');
    return row ? toDomain(row) : null;
  }

  save(challenge: LoginChallenge): Promise<void> {
    return saveAggregate(this.context, challenge, async () => {
      try {
        // INFO: Only a pending row may change, so a resend cannot revive a consumed challenge.
        const written = await this.context.client
          .insert(loginChallenges)
          .values(toPersistence(challenge))
          .onConflictDoUpdate({
            target: loginChallenges.id,
            set: { ...toMutableColumns(challenge), updatedAt: new Date() },
            setWhere: eq(loginChallenges.status, LoginChallengeStatus.PENDING),
          })
          .returning({ id: loginChallenges.id });
        if (written.length === 0) {
          throw new LoginChallengeAlreadyPendingError();
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new LoginChallengeAlreadyPendingError();
        }
        throw error;
      }
    });
  }

  private pendingFor(email: Email, tenantId: Nullable<TenantId>) {
    return and(
      tenantId ? eq(loginChallenges.tenantId, tenantId) : isNull(loginChallenges.tenantId),
      eq(loginChallenges.email, email.value),
      eq(loginChallenges.status, LoginChallengeStatus.PENDING),
    );
  }
}
