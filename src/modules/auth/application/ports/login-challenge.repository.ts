import type { Email } from '@common/primitives';
import type { TenantId } from '@modules/tenants';

import type { LoginChallenge } from '../../domain/entities/login-challenge.js';

// `tenantId` is null for admin logins.
export interface LoginChallengeRepository {
  findPendingByEmail(email: Email, tenantId: TenantId | null): Promise<LoginChallenge | null>;
  findPendingByEmailForUpdate(
    email: Email,
    tenantId: TenantId | null,
  ): Promise<LoginChallenge | null>;
  save(challenge: LoginChallenge): Promise<void>;
}

export const LOGIN_CHALLENGE_REPOSITORY = Symbol('LOGIN_CHALLENGE_REPOSITORY');
