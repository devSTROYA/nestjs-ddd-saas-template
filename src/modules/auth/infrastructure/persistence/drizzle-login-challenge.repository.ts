import { and, eq, isNull } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { saveAggregate } from '@common/outbox';
import { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import { TenantId } from '@modules/tenants';

import type { LoginChallengeRepository } from '../../application/ports/login-challenge.repository.js';
import { LoginChallenge } from '../../domain/entities/login-challenge.js';
import {
  InvalidLoginChallengeStatusError,
  LoginChallengeAlreadyPendingError,
} from '../../domain/errors/domain.error.js';
import { LoginChallengeId } from '../../domain/value-objects/ids.js';
import {
  LoginChallengeStatus,
  isLoginChallengeStatus,
} from '../../domain/value-objects/login-challenge-status.js';
import { type LoginChallengeRow, loginChallenges } from './login-challenge.schema.js';

function toChallenge(row: LoginChallengeRow): LoginChallenge {
  if (!isLoginChallengeStatus(row.status)) {
    throw new InvalidLoginChallengeStatusError(row.status);
  }
  return LoginChallenge.restore(
    {
      tenantId: row.tenantId ? TenantId.restore(row.tenantId) : null,
      email: Email.restore(row.email),
      otpHash: row.otpHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      status: row.status,
      createdAt: row.createdAt,
    },
    LoginChallengeId.restore(row.id),
  );
}

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
    return row ? toChallenge(row) : null;
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
    return row ? toChallenge(row) : null;
  }

  save(challenge: LoginChallenge): Promise<void> {
    return saveAggregate(this.context, challenge, async () => {
      const mutable = {
        otpHash: challenge.otpHash,
        expiresAt: challenge.expiresAt,
        attempts: challenge.attempts,
        status: challenge.status,
      };
      try {
        // INFO: Only a pending row may change, so a resend cannot revive a consumed challenge.
        const written = await this.context.client
          .insert(loginChallenges)
          .values({
            id: challenge.id.value,
            tenantId: challenge.tenantId?.value ?? null,
            email: challenge.email.value,
            createdAt: challenge.createdAt,
            ...mutable,
          })
          .onConflictDoUpdate({
            target: loginChallenges.id,
            set: { ...mutable, updatedAt: new Date() },
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
      tenantId ? eq(loginChallenges.tenantId, tenantId.value) : isNull(loginChallenges.tenantId),
      eq(loginChallenges.email, email.value),
      eq(loginChallenges.status, LoginChallengeStatus.PENDING),
    );
  }
}
