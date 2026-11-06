import { Email } from '@common/primitives';
import { RateLimitExceededError } from '@common/rate-limit';
import { TenantId } from '@modules/tenants';
import { User, UserName } from '@modules/users';

import { LoginChallengeStatus } from '../../../domain/value-objects/login-challenge-status.js';
import { type AuthKit, OTP, createAuthKit } from '../../../testing/fakes.js';
import { LOGIN_CODE_PER_EMAIL } from '../../rate-limits.js';
import { RequestUserLoginCommand } from './request-user-login.command.js';

const TENANT_ID = TenantId.create();

const request = (kit: AuthKit, email = 'owner@acme.co') =>
  kit.requestUserLogin.execute(new RequestUserLoginCommand(email));

const withUser = async (): Promise<AuthKit> => {
  const kit = createAuthKit();
  await kit.users.save(
    User.create({
      tenantId: TENANT_ID,
      email: Email.create('owner@acme.co'),
      name: UserName.create('Owner'),
      createdAt: kit.clock.current,
    }),
  );
  return kit;
};

describe('RequestUserLoginHandler', () => {
  it('creates a challenge scoped to the tenant of the user and emails the otp', async () => {
    const kit = await withUser();

    await request(kit, ' Owner@ACME.co ');

    const [challenge] = [...kit.challenges.saved.values()];
    expect(challenge?.tenantId).toEqual(TENANT_ID);
    expect(challenge?.email.value).toBe('owner@acme.co');
    expect(challenge?.status).toBe(LoginChallengeStatus.PENDING);
    expect(kit.mailer.sent).toHaveLength(1);
    expect(kit.mailer.sent[0]?.otp).toBe(OTP);
  });

  it('answers silently and sends nothing for an unknown email', async () => {
    const kit = await withUser();

    await expect(request(kit, 'stranger@acme.co')).resolves.toBeUndefined();

    expect(kit.challenges.saved.size).toBe(0);
    expect(kit.mailer.sent).toHaveLength(0);
  });

  it('limits codes per email, the same for existing and unknown emails', async () => {
    const kit = await withUser();

    for (const email of ['owner@acme.co', 'stranger@acme.co']) {
      for (let i = 0; i < LOGIN_CODE_PER_EMAIL.limit; i++) {
        await request(kit, email);
      }
      await expect(request(kit, email)).rejects.toThrow(RateLimitExceededError);
    }
  });
});
