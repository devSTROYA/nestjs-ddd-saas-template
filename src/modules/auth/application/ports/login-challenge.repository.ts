import type { Email } from '@common/primitives';
import type { Nullable } from '@common/types';
import type { TenantId } from '@modules/tenants';

import type { LoginChallenge } from '../../domain/entities/login-challenge.js';

// `tenantId` is null for admin logins.
export interface LoginChallengeRepository {
  findPendingByEmail(email: Email, tenantId: Nullable<TenantId>): Promise<Nullable<LoginChallenge>>;
  findPendingByEmailForUpdate(
    email: Email,
    tenantId: Nullable<TenantId>,
  ): Promise<Nullable<LoginChallenge>>;
  save(challenge: LoginChallenge): Promise<void>;
}

export const LOGIN_CHALLENGE_REPOSITORY = Symbol('LOGIN_CHALLENGE_REPOSITORY');
