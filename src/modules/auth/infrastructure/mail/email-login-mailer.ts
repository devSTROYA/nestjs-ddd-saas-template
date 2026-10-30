import type { MailTransport } from '@common/mail';

import type { LoginMailer } from '../../application/ports/login-mailer.js';

export class EmailLoginMailer implements LoginMailer {
  constructor(private readonly transport: MailTransport) {}

  sendLoginOtp(message: Parameters<LoginMailer['sendLoginOtp']>[0]): Promise<void> {
    const expires = message.expiresAt.toUTCString();
    return this.transport.send({
      to: message.to.value,
      subject: 'Your login code',
      text: [
        `Your login code is ${message.otp}.`,
        '',
        `It expires at ${expires}. If you did not ask for it, you can ignore this email.`,
      ].join('\n'),
      html:
        `<p>Your login code is <strong>${message.otp}</strong>.</p>` +
        `<p>It expires at ${expires}. If you did not ask for it, you can ignore this email.</p>`,
    });
  }
}
