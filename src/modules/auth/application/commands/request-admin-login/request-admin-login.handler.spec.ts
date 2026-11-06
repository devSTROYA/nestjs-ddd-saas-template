import { Logger } from '@nestjs/common';

import { MailDeliveryError } from '@common/mail';
import { RateLimitExceededError } from '@common/rate-limit';
import { Admin } from '@modules/admins';
import { Email, InvalidEmailError } from '@common/primitives';

import { LOGIN_CODE_PER_EMAIL } from '../../rate-limits.js';
import { LoginChallengeAlreadyPendingError } from '../../../domain/errors/domain.error.js';
import { LoginChallengeStatus } from '../../../domain/value-objects/login-challenge-status.js';
import { type AuthKit, OTP, createAuthKit, fakeOtpService } from '../../../testing/fakes.js';
import { LOGIN_OTP_TTL_MS } from '../../token-lifetimes.js';
import { RequestAdminLoginCommand } from './request-admin-login.command.js';

const request = (kit: AuthKit, email = 'root@b.co') =>
  kit.requestLogin.execute(new RequestAdminLoginCommand(email));

const withAdmin = async (): Promise<AuthKit> => {
  const kit = createAuthKit();
  await kit.admins.save(
    Admin.create({ email: Email.create('root@b.co'), createdAt: kit.clock.current }),
  );
  return kit;
};

describe('RequestAdminLoginHandler', () => {
  it('creates a pending challenge for an admin and emails the otp', async () => {
    const kit = await withAdmin();

    await request(kit, ' Root@B.co ');

    const [challenge] = [...kit.challenges.saved.values()];
    expect(challenge?.email.value).toBe('root@b.co');
    expect(challenge?.status).toBe(LoginChallengeStatus.PENDING);
    expect(challenge?.otpHash).toBe(fakeOtpService.hash(challenge?.id.value ?? '', OTP));
    expect(challenge?.expiresAt).toEqual(new Date(kit.clock.current.getTime() + LOGIN_OTP_TTL_MS));
    expect(kit.mailer.sent).toHaveLength(1);
    expect(kit.mailer.sent[0]?.otp).toBe(OTP);
    expect(kit.mailer.sent[0]?.to.value).toBe('root@b.co');
  });

  it('answers silently and sends nothing when the email is not an admin', async () => {
    const kit = await withAdmin();

    await expect(request(kit, 'stranger@b.co')).resolves.toBeUndefined();

    expect(kit.challenges.saved.size).toBe(0);
    expect(kit.mailer.sent).toHaveLength(0);
  });

  it('reuses the pending challenge and resets its attempts when asked again', async () => {
    const kit = await withAdmin();
    await request(kit);
    const [challenge] = [...kit.challenges.saved.values()];
    challenge?.verify(false, kit.clock.current);

    await request(kit);

    expect(kit.challenges.saved.size).toBe(1);
    expect(challenge?.attempts).toBe(0);
    expect(kit.mailer.sent).toHaveLength(2);
  });

  it('treats losing a race for the single pending challenge as success without a second email', async () => {
    const kit = await withAdmin();
    kit.challenges.saveError = new LoginChallengeAlreadyPendingError();

    await expect(request(kit)).resolves.toBeUndefined();

    expect(kit.mailer.sent).toHaveLength(0);
  });

  it('still answers normally when the email cannot be delivered, so an admin is not revealed', async () => {
    const kit = await withAdmin();
    kit.mailer.sendError = new MailDeliveryError('provider down');
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    await expect(request(kit)).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });

  it('does not hide unexpected mail failures', async () => {
    const kit = await withAdmin();
    kit.mailer.sendError = new Error('bug');

    await expect(request(kit)).rejects.toThrow('bug');
  });

  it('limits how many codes can be requested per email, for admins and strangers alike', async () => {
    const kit = await withAdmin();

    for (const email of ['root@b.co', 'stranger@b.co']) {
      for (let i = 0; i < LOGIN_CODE_PER_EMAIL.limit; i++) {
        await request(kit, email);
      }
      await expect(request(kit, email)).rejects.toThrow(RateLimitExceededError);
    }
    expect(kit.mailer.sent).toHaveLength(LOGIN_CODE_PER_EMAIL.limit);
  });

  it('counts a differently written email as the same address', async () => {
    const kit = await withAdmin();

    for (let i = 0; i < LOGIN_CODE_PER_EMAIL.limit; i++) {
      await request(kit, i % 2 === 0 ? 'root@b.co' : ' ROOT@B.CO ');
    }

    await expect(request(kit)).rejects.toThrow(RateLimitExceededError);
  });

  it('rejects a malformed email', async () => {
    await expect(request(await withAdmin(), 'nope')).rejects.toThrow(InvalidEmailError);
  });
});
