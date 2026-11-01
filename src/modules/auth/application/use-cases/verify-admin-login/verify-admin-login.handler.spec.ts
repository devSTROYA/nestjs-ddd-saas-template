import { Email } from '@common/primitives';
import { RateLimitExceededError } from '@common/rate-limit';
import { Admin } from '@modules/admins';

import { MAX_LOGIN_ATTEMPTS } from '../../../domain/entities/login-challenge.js';
import { InvalidCredentialsError } from '../../../domain/errors/domain.error.js';
import { LoginChallengeStatus } from '../../../domain/value-objects/login-challenge-status.js';
import { PrincipalType } from '../../../domain/value-objects/principal.js';
import {
  type AuthKit,
  IP,
  OTHER_IP,
  OTP,
  WRONG_OTP,
  createAuthKit,
} from '../../../testing/fakes.js';
import {
  LOGIN_VERIFY_FAILURES_PER_EMAIL,
  LOGIN_VERIFY_FAILURES_PER_EMAIL_IP,
} from '../../rate-limits.js';
import { RequestAdminLoginCommand } from '../request-admin-login/request-admin-login.command.js';
import { LOGIN_OTP_TTL_MS, REFRESH_TOKEN_TTL_MS } from '../../token-lifetimes.js';
import { VerifyAdminLoginCommand } from './verify-admin-login.command.js';

const verify = (kit: AuthKit, otp: string, email = 'root@b.co', ip = IP) =>
  kit.verifyLogin.execute(new VerifyAdminLoginCommand(email, otp, ip));

const withPendingLogin = async () => {
  const kit = createAuthKit();
  const admin = Admin.create({ email: Email.create('root@b.co'), createdAt: kit.clock.current });
  await kit.admins.save(admin);
  await kit.requestLogin.execute(new RequestAdminLoginCommand('root@b.co'));
  return { kit, admin };
};

describe('VerifyAdminLoginHandler', () => {
  it('issues an access token and a refresh token for the admin on the right otp', async () => {
    const { kit, admin } = await withPendingLogin();

    const session = await verify(kit, OTP);

    expect(await kit.tokens.verifyAccessToken(session.accessToken)).toEqual({
      type: PrincipalType.ADMIN,
      id: admin.id.value,
    });
    expect(session.expiresInSeconds).toBe(900);
    const [stored] = [...kit.refreshTokens.saved.values()];
    expect(stored?.tokenHash).toBe(kit.codec.hash(session.refreshToken));
    expect(stored?.tokenHash).not.toBe(session.refreshToken);
    expect(stored?.principal).toEqual({ type: PrincipalType.ADMIN, id: admin.id.value });
    expect(stored?.expiresAt).toEqual(new Date(kit.clock.current.getTime() + REFRESH_TOKEN_TTL_MS));
    expect([...kit.challenges.saved.values()][0]?.status).toBe(LoginChallengeStatus.CONSUMED);
  });

  it('cannot reuse a consumed challenge', async () => {
    const { kit } = await withPendingLogin();
    await verify(kit, OTP);

    await expect(verify(kit, OTP)).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects a wrong otp, records the attempt and issues nothing', async () => {
    const { kit } = await withPendingLogin();

    await expect(verify(kit, WRONG_OTP)).rejects.toThrow(InvalidCredentialsError);

    expect([...kit.challenges.saved.values()][0]?.attempts).toBe(1);
    expect(kit.refreshTokens.saved.size).toBe(0);
  });

  it('gives the same failure for an unknown email, an expired challenge and a locked one', async () => {
    const { kit } = await withPendingLogin();
    await expect(verify(kit, OTP, 'stranger@b.co')).rejects.toThrow(InvalidCredentialsError);

    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      await expect(verify(kit, WRONG_OTP)).rejects.toThrow(InvalidCredentialsError);
    }
    await expect(verify(kit, OTP)).rejects.toThrow(InvalidCredentialsError);

    const fresh = await withPendingLogin();
    fresh.kit.clock.current = new Date(fresh.kit.clock.current.getTime() + LOGIN_OTP_TTL_MS);
    await expect(verify(fresh.kit, OTP)).rejects.toThrow(InvalidCredentialsError);
    expect(fresh.kit.refreshTokens.saved.size).toBe(0);
  });

  it('stops a guesser per email and IP while the admin can still log in from elsewhere', async () => {
    const { kit } = await withPendingLogin();

    for (let i = 0; i < LOGIN_VERIFY_FAILURES_PER_EMAIL_IP.limit; i++) {
      await expect(verify(kit, WRONG_OTP, 'root@b.co', OTHER_IP)).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    await expect(verify(kit, OTP, 'root@b.co', OTHER_IP)).rejects.toThrow(RateLimitExceededError);
    expect(kit.refreshTokens.saved.size).toBe(0);
    await kit.requestLogin.execute(new RequestAdminLoginCommand('root@b.co'));
    await expect(verify(kit, OTP)).resolves.toBeDefined();
  });

  it('caps failures per email across IPs, however the challenge looks', async () => {
    const { kit } = await withPendingLogin();

    for (let i = 0; i < LOGIN_VERIFY_FAILURES_PER_EMAIL.limit; i++) {
      await expect(verify(kit, WRONG_OTP, 'root@b.co', `10.0.0.${i}`)).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    await expect(verify(kit, OTP, 'root@b.co', '10.9.9.9')).rejects.toThrow(RateLimitExceededError);
    expect(kit.refreshTokens.saved.size).toBe(0);
  });
});
