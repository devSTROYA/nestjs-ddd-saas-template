import type { Email } from '@common/primitives';

export interface LoginMailer {
  sendLoginOtp(message: { to: Email; otp: string; expiresAt: Date }): Promise<void>;
}

export const LOGIN_MAILER = Symbol('LOGIN_MAILER');
