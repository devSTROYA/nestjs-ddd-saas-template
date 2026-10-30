import { Email } from '@common/primitives';
import { newTenantId } from '@modules/tenants';
import { User, UserName, newUserId } from '@modules/users';

import { InvalidCredentialsError } from '../../../domain/errors/domain.error.js';
import { PrincipalType } from '../../../domain/value-objects/principal.js';
import { RateLimitExceededError } from '@common/rate-limit';

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
import { RequestUserLoginCommand } from '../request-user-login/request-user-login.command.js';
import { VerifyUserLoginCommand } from './verify-user-login.command.js';

const addUser = async (kit: AuthKit, email: string) => {
  const user = User.create({
    id: newUserId(),
    tenantId: newTenantId(),
    email: Email.create(email),
    name: UserName.create('Owner'),
  });
  await kit.users.save(user);
  return user;
};

const requestCode = (kit: AuthKit, email: string) =>
  kit.requestUserLogin.execute(new RequestUserLoginCommand(email));

const verify = (kit: AuthKit, email: string, otp = OTP, ip = IP) =>
  kit.verifyUserLogin.execute(new VerifyUserLoginCommand(email, otp, ip));

describe('VerifyUserLoginHandler', () => {
  it('issues a session for the user, carrying the tenant', async () => {
    const kit = createAuthKit();
    const user = await addUser(kit, 'owner@acme.co');
    await requestCode(kit, 'owner@acme.co');

    const session = await verify(kit, 'owner@acme.co');

    expect(session.accessToken).toBe(`access:user:${user.id}:${user.tenantId}`);
    const [stored] = [...kit.refreshTokens.saved.values()];
    expect(stored?.principal).toEqual({
      type: PrincipalType.USER,
      id: user.id,
      tenantId: user.tenantId,
    });
  });

  it('does not accept a code that was requested for another user', async () => {
    const kit = createAuthKit();
    await addUser(kit, 'one@acme.co');
    await addUser(kit, 'two@beta.co');
    await requestCode(kit, 'one@acme.co');

    await expect(verify(kit, 'two@beta.co')).rejects.toThrow(InvalidCredentialsError);
    await expect(verify(kit, 'one@acme.co')).resolves.toBeDefined();
  });

  it('answers the same error for a wrong code and an unknown user', async () => {
    const kit = createAuthKit();
    await addUser(kit, 'owner@acme.co');
    await requestCode(kit, 'owner@acme.co');

    await expect(verify(kit, 'owner@acme.co', WRONG_OTP)).rejects.toThrow(InvalidCredentialsError);
    await expect(verify(kit, 'stranger@acme.co')).rejects.toThrow(InvalidCredentialsError);
  });

  it('cannot reuse a consumed code', async () => {
    const kit = createAuthKit();
    await addUser(kit, 'owner@acme.co');
    await requestCode(kit, 'owner@acme.co');
    await verify(kit, 'owner@acme.co');

    await expect(verify(kit, 'owner@acme.co')).rejects.toThrow(InvalidCredentialsError);
  });

  it('blocks a guesser per email and IP, but not the owner coming from another IP', async () => {
    const kit = createAuthKit();
    await addUser(kit, 'owner@acme.co');
    await requestCode(kit, 'owner@acme.co');

    for (let i = 0; i < LOGIN_VERIFY_FAILURES_PER_EMAIL_IP.limit; i++) {
      await expect(verify(kit, 'owner@acme.co', WRONG_OTP, OTHER_IP)).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    await expect(verify(kit, 'owner@acme.co', OTP, OTHER_IP)).rejects.toThrow(
      RateLimitExceededError,
    );
    // The guesses also locked the pending code, so the owner asks for a new one.
    await requestCode(kit, 'owner@acme.co');
    await expect(verify(kit, 'owner@acme.co')).resolves.toBeDefined();
  });

  it('caps failures per email across IPs, and successful logins do not count', async () => {
    const kit = createAuthKit();
    await addUser(kit, 'owner@acme.co');
    await requestCode(kit, 'owner@acme.co');
    await verify(kit, 'owner@acme.co');

    for (let i = 0; i < LOGIN_VERIFY_FAILURES_PER_EMAIL.limit; i++) {
      await expect(verify(kit, 'owner@acme.co', WRONG_OTP, `10.0.0.${i}`)).rejects.toThrow(
        InvalidCredentialsError,
      );
    }

    await expect(verify(kit, 'owner@acme.co', OTP, '10.9.9.9')).rejects.toThrow(
      RateLimitExceededError,
    );
  });
});
