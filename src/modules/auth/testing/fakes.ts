import type { Clock } from '@common/clock';
import type { UnitOfWork } from '@common/database';
import type { OtpService } from '@common/otp';
import type { Email } from '@common/primitives';
import { type RateLimitRule, type RateLimiter, RateLimitExceededError } from '@common/rate-limit';
import type { Nullable } from '@common/types';
import type { Admin, AdminId, AdminRepository } from '@modules/admins';
import type { TenantId } from '@modules/tenants';
import type { User, UserId, UserRepository } from '@modules/users';

import type { LoginChallengeRepository } from '../application/ports/login-challenge.repository.js';
import type { LoginMailer } from '../application/ports/login-mailer.js';
import type { RefreshTokenCodec } from '../application/ports/refresh-token-codec.js';
import type { RefreshTokenRepository } from '../application/ports/refresh-token.repository.js';
import type { AccessToken, TokenService } from '../application/ports/token.service.js';
import { LoginCodes } from '../application/login-codes.service.js';
import { SessionService } from '../application/session.service.js';
import { RequestUserLoginHandler } from '../application/use-cases/request-user-login/request-user-login.handler.js';
import { VerifyUserLoginHandler } from '../application/use-cases/verify-user-login/verify-user-login.handler.js';
import { LogoutHandler } from '../application/use-cases/logout/logout.handler.js';
import { RefreshTokensHandler } from '../application/use-cases/refresh-tokens/refresh-tokens.handler.js';
import { RequestAdminLoginHandler } from '../application/use-cases/request-admin-login/request-admin-login.handler.js';
import { VerifyAdminLoginHandler } from '../application/use-cases/verify-admin-login/verify-admin-login.handler.js';
import type { LoginChallenge } from '../domain/entities/login-challenge.js';
import { RefreshToken } from '../domain/entities/refresh-token.js';
import type { TokenFamilyId } from '../domain/value-objects/ids.js';
import { LoginChallengeStatus } from '../domain/value-objects/login-challenge-status.js';
import { type Principal, isPrincipalType } from '../domain/value-objects/principal.js';

export const NOW = new Date('2026-01-01T00:00:00Z');
export const OTP = '123456';
export const WRONG_OTP = '000000';
export const IP = '203.0.113.7';
export const OTHER_IP = '198.51.100.9';

export class MutableClock implements Clock {
  constructor(public current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class FakeAdmins implements AdminRepository {
  readonly saved = new Map<string, Admin>();

  findById(id: AdminId): Promise<Nullable<Admin>> {
    return Promise.resolve(this.saved.get(id.value) ?? null);
  }

  findByEmail(email: Email): Promise<Nullable<Admin>> {
    const found = [...this.saved.values()].find((admin) => admin.email.equals(email));
    return Promise.resolve(found ?? null);
  }

  save(admin: Admin): Promise<void> {
    this.saved.set(admin.id.value, admin);
    return Promise.resolve();
  }
}

export class FakeUsers implements UserRepository {
  readonly saved = new Map<string, User>();

  findById(tenantId: TenantId, id: UserId): Promise<Nullable<User>> {
    const found = this.saved.get(id.value);
    return Promise.resolve(found?.tenantId.equals(tenantId) ? found : null);
  }

  findByEmail(email: Email): Promise<Nullable<User>> {
    const found = [...this.saved.values()].find((user) => user.email.equals(email));
    return Promise.resolve(found ?? null);
  }

  save(user: User): Promise<void> {
    this.saved.set(user.id.value, user);
    return Promise.resolve();
  }

  delete(tenantId: TenantId, id: UserId): Promise<void> {
    if (this.saved.get(id.value)?.tenantId.equals(tenantId)) {
      this.saved.delete(id.value);
    }
    return Promise.resolve();
  }
}

export class FakeLoginChallenges implements LoginChallengeRepository {
  readonly saved = new Map<string, LoginChallenge>();
  saveError: Nullable<Error> = null;

  findPendingByEmail(
    email: Email,
    tenantId: Nullable<TenantId>,
  ): Promise<Nullable<LoginChallenge>> {
    const found = [...this.saved.values()].find(
      (challenge) =>
        challenge.email.equals(email) &&
        (challenge.tenantId === null
          ? tenantId === null
          : tenantId !== null && challenge.tenantId.equals(tenantId)) &&
        challenge.status === LoginChallengeStatus.PENDING,
    );
    return Promise.resolve(found ?? null);
  }

  findPendingByEmailForUpdate(
    email: Email,
    tenantId: Nullable<TenantId>,
  ): Promise<Nullable<LoginChallenge>> {
    return this.findPendingByEmail(email, tenantId);
  }

  save(challenge: LoginChallenge): Promise<void> {
    if (this.saveError) {
      return Promise.reject(this.saveError);
    }
    this.saved.set(challenge.id.value, challenge);
    return Promise.resolve();
  }
}

export class FakeRefreshTokens implements RefreshTokenRepository {
  readonly saved = new Map<string, RefreshToken>();

  findByHashForUpdate(tokenHash: string): Promise<Nullable<RefreshToken>> {
    const found = [...this.saved.values()].find((token) => token.tokenHash === tokenHash);
    return Promise.resolve(found ?? null);
  }

  save(token: RefreshToken): Promise<void> {
    this.saved.set(token.id.value, token);
    return Promise.resolve();
  }

  revokeFamily(familyId: TokenFamilyId, now: Date): Promise<void> {
    for (const token of this.saved.values()) {
      if (token.familyId.equals(familyId) && token.revokedAt === null) {
        this.saved.set(
          token.id.value,
          RefreshToken.restore(
            {
              familyId: token.familyId,
              principal: token.principal,
              tokenHash: token.tokenHash,
              expiresAt: token.expiresAt,
              usedAt: token.usedAt,
              revokedAt: now,
              createdAt: token.createdAt,
            },
            token.id,
          ),
        );
      }
    }
    return Promise.resolve();
  }

  inFamily(familyId: TokenFamilyId): RefreshToken[] {
    return [...this.saved.values()].filter((token) => token.familyId.equals(familyId));
  }
}

export class FakeLoginMailer implements LoginMailer {
  readonly sent: Parameters<LoginMailer['sendLoginOtp']>[0][] = [];
  sendError: Nullable<Error> = null;

  sendLoginOtp(message: Parameters<LoginMailer['sendLoginOtp']>[0]): Promise<void> {
    if (this.sendError) {
      return Promise.reject(this.sendError);
    }
    this.sent.push(message);
    return Promise.resolve();
  }
}

export class FakeRateLimiter implements RateLimiter {
  private readonly counts = new Map<string, number>();

  consume(rule: RateLimitRule, subject: string): Promise<void> {
    const key = `${rule.name}:${subject}`;
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return count > rule.limit ? Promise.reject(new RateLimitExceededError(60)) : Promise.resolve();
  }

  assertBelow(rule: RateLimitRule, subject: string): Promise<void> {
    const count = this.counts.get(`${rule.name}:${subject}`) ?? 0;
    return count >= rule.limit ? Promise.reject(new RateLimitExceededError(60)) : Promise.resolve();
  }
}

export class FakeTokenService implements TokenService {
  issueAccessToken(principal: Principal): Promise<AccessToken> {
    return Promise.resolve({
      token: `access:${principal.type}:${principal.id}:${principal.tenantId ?? ''}`,
      expiresInSeconds: 900,
    });
  }

  verifyAccessToken(token: string): Promise<Nullable<Principal>> {
    const [prefix, type, id, tenantId] = token.split(':');
    return Promise.resolve(
      prefix === 'access' && type && id && isPrincipalType(type)
        ? { type, id, ...(tenantId ? { tenantId } : {}) }
        : null,
    );
  }
}

export class FakeRefreshTokenCodec implements RefreshTokenCodec {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `refresh-${this.counter}`;
  }

  hash(token: string): string {
    return `hash:${token}`;
  }
}

export const fakeOtpService: OtpService = {
  generate: () => OTP,
  hash: (subjectId, otp) => `hash:${subjectId}:${otp}`,
  matches: (subjectId, otp, hash) => hash === `hash:${subjectId}:${otp}`,
};

export const fakeUnitOfWork: UnitOfWork = {
  run: (work) => work(),
};

export function createAuthKit() {
  const clock = new MutableClock(NOW);
  const admins = new FakeAdmins();
  const users = new FakeUsers();
  const challenges = new FakeLoginChallenges();
  const refreshTokens = new FakeRefreshTokens();
  const mailer = new FakeLoginMailer();
  const tokens = new FakeTokenService();
  const codec = new FakeRefreshTokenCodec();
  const rateLimiter = new FakeRateLimiter();
  const sessions = new SessionService(refreshTokens, codec, tokens);
  const loginCodes = new LoginCodes(challenges, fakeOtpService, mailer, clock);

  return {
    clock,
    admins,
    users,
    challenges,
    refreshTokens,
    mailer,
    tokens,
    codec,
    sessions,
    rateLimiter,
    requestLogin: new RequestAdminLoginHandler(admins, loginCodes, rateLimiter),
    verifyLogin: new VerifyAdminLoginHandler(
      admins,
      loginCodes,
      fakeUnitOfWork,
      clock,
      sessions,
      rateLimiter,
    ),
    requestUserLogin: new RequestUserLoginHandler(users, loginCodes, rateLimiter),
    verifyUserLogin: new VerifyUserLoginHandler(
      users,
      loginCodes,
      fakeUnitOfWork,
      clock,
      sessions,
      rateLimiter,
    ),
    refresh: new RefreshTokensHandler(
      admins,
      users,
      refreshTokens,
      codec,
      fakeUnitOfWork,
      clock,
      sessions,
    ),
    logout: new LogoutHandler(refreshTokens, codec, fakeUnitOfWork, clock),
  };
}

export type AuthKit = ReturnType<typeof createAuthKit>;
