import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK, type Clock } from '@common/clock';
import { MailDeliveryError } from '@common/mail';
import { OTP_SERVICE, type OtpService } from '@common/otp';
import type { Email } from '@common/primitives';
import type { TenantId } from '@modules/tenants';

import { LoginChallenge } from '../domain/entities/login-challenge.js';
import { LoginChallengeAlreadyPendingError } from '../domain/errors/domain.error.js';
import { newLoginChallengeId } from '../domain/value-objects/ids.js';
import {
  LOGIN_CHALLENGE_REPOSITORY,
  type LoginChallengeRepository,
} from './ports/login-challenge.repository.js';
import { LOGIN_MAILER, type LoginMailer } from './ports/login-mailer.js';
import { LOGIN_OTP_TTL_MS } from './token-lifetimes.js';

// The one-time login code shared by admins (tenantId null) and tenant users.
@Injectable()
export class LoginCodes {
  private readonly logger = new Logger(LoginCodes.name);

  constructor(
    @Inject(LOGIN_CHALLENGE_REPOSITORY) private readonly challenges: LoginChallengeRepository,
    @Inject(OTP_SERVICE) private readonly otpService: OtpService,
    @Inject(LOGIN_MAILER) private readonly mailer: LoginMailer,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // Never reveals whether a code was already pending, and a failed delivery is only logged.
  async send(email: Email, tenantId: TenantId | null): Promise<void> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + LOGIN_OTP_TTL_MS);
    const otp = this.otpService.generate();

    try {
      await this.challenges.save(await this.challengeFor(email, tenantId, otp, expiresAt, now));
    } catch (error) {
      if (error instanceof LoginChallengeAlreadyPendingError) {
        return;
      }
      throw error;
    }
    try {
      await this.mailer.sendLoginOtp({ to: email, otp, expiresAt });
    } catch (error) {
      if (!(error instanceof MailDeliveryError)) {
        throw error;
      }
      this.logger.error(error.message);
    }
  }

  // Must run inside a transaction: the challenge row is locked while the attempt is counted.
  async consume(email: Email, tenantId: TenantId | null, otp: string, now: Date): Promise<boolean> {
    const challenge = await this.challenges.findPendingByEmailForUpdate(email, tenantId);
    if (!challenge) {
      return false;
    }
    const verified = challenge.verify(
      this.otpService.matches(challenge.id, otp, challenge.otpHash),
      now,
    );
    await this.challenges.save(challenge);
    return verified;
  }

  private async challengeFor(
    email: Email,
    tenantId: TenantId | null,
    otp: string,
    expiresAt: Date,
    now: Date,
  ): Promise<LoginChallenge> {
    const pending = await this.challenges.findPendingByEmail(email, tenantId);
    if (pending) {
      pending.regenerate(this.otpService.hash(pending.id, otp), expiresAt);
      return pending;
    }
    const id = newLoginChallengeId();
    return LoginChallenge.create(
      { id, tenantId, email, otpHash: this.otpService.hash(id, otp), expiresAt },
      now,
    );
  }
}
