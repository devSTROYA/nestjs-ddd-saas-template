import { and, eq, isNull } from 'drizzle-orm';

import { type DatabaseContext, isUniqueViolation } from '@common/database';
import { Email } from '@common/primitives';
import { type TenantId, toTenantId } from '@modules/tenants';

import type { LoginChallengeRepository } from '../../application/ports/login-challenge.repository.js';
import { LoginChallenge } from '../../domain/entities/login-challenge.js';
import {
  InvalidLoginChallengeStatusError,
  LoginChallengeAlreadyPendingError,
} from '../../domain/errors/domain.error.js';
import { toLoginChallengeId } from '../../domain/value-objects/ids.js';
import {
  LoginChallengeStatus,
  isLoginChallengeStatus,
} from '../../domain/value-objects/login-challenge-status.js';
import { type LoginChallengeRow, loginChallenges } from './login-challenge.schema.js';

function toChallenge(row: LoginChallengeRow): LoginChallenge {
  if (!isLoginChallengeStatus(row.status)) {
    throw new InvalidLoginChallengeStatusError(row.status);
  }
  return LoginChallenge.restore({
    id: toLoginChallengeId(row.id),
    tenantId: row.tenantId ? toTenantId(row.tenantId) : null,
    email: Email.restore(row.email),
    otpHash: row.otpHash,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    status: row.status,
    createdAt: row.createdAt,
  });
}

export class DrizzleLoginChallengeRepository implements LoginChallengeRepository {
  constructor(private readonly context: DatabaseContext) {}

  async findPendingByEmail(
    email: Email,
    tenantId: TenantId | null,
  ): Promise<LoginChallenge | null> {
    const [row] = await this.context.client
      .select()
      .from(loginChallenges)
      .where(this.pendingFor(email, tenantId));
    return row ? toChallenge(row) : null;
  }

  async findPendingByEmailForUpdate(
    email: Email,
    tenantId: TenantId | null,
  ): Promise<LoginChallenge | null> {
    const [row] = await this.context.client
      .select()
      .from(loginChallenges)
      .where(this.pendingFor(email, tenantId))
      .for('update');
    return row ? toChallenge(row) : null;
  }

  async save(challenge: LoginChallenge): Promise<void> {
    const mutable = {
      otpHash: challenge.otpHash,
      expiresAt: challenge.expiresAt,
      attempts: challenge.attempts,
      status: challenge.status,
    };
    try {
      // Only a pending row may change, so a resend cannot revive a challenge consumed meanwhile.
      const written = await this.context.client
        .insert(loginChallenges)
        .values({
          id: challenge.id,
          tenantId: challenge.tenantId,
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
  }

  private pendingFor(email: Email, tenantId: TenantId | null) {
    return and(
      tenantId ? eq(loginChallenges.tenantId, tenantId) : isNull(loginChallenges.tenantId),
      eq(loginChallenges.email, email.value),
      eq(loginChallenges.status, LoginChallengeStatus.PENDING),
    );
  }
}
