import { Email } from '@common/primitives';
import { TenantId } from '@modules/tenants';

import { LoginChallenge } from '../../domain/entities/login-challenge.js';
import { InvalidLoginChallengeStatusError } from '../../domain/errors/domain.error.js';
import { LoginChallengeId } from '../../domain/value-objects/ids.js';
import { isLoginChallengeStatus } from '../../domain/value-objects/login-challenge-status.js';
import type { LoginChallengeNewRow, LoginChallengeRow } from './login-challenge.schema.js';

export function toDomain(row: LoginChallengeRow): LoginChallenge {
  if (!isLoginChallengeStatus(row.status)) {
    throw new InvalidLoginChallengeStatusError(row.status);
  }
  return LoginChallenge.rehydrate(
    {
      tenantId: row.tenantId ? TenantId.rehydrate(row.tenantId) : null,
      email: Email.rehydrate(row.email),
      otpHash: row.otpHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      status: row.status,
      createdAt: row.createdAt,
    },
    LoginChallengeId.rehydrate(row.id),
  );
}

export function toPersistence(challenge: LoginChallenge): LoginChallengeNewRow {
  return {
    id: challenge.id,
    tenantId: challenge.tenantId ?? null,
    email: challenge.email.value,
    createdAt: challenge.createdAt,
    ...toMutableColumns(challenge),
  };
}

// Columns an upsert may overwrite; id, tenant, email and createdAt stay as first written.
export function toMutableColumns(
  challenge: LoginChallenge,
): Pick<LoginChallengeNewRow, 'otpHash' | 'expiresAt' | 'attempts' | 'status'> {
  return {
    otpHash: challenge.otpHash,
    expiresAt: challenge.expiresAt,
    attempts: challenge.attempts,
    status: challenge.status,
  };
}
