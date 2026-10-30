import type { MailMessage, MailTransport } from '@common/mail';
import { Email } from '@common/primitives';

import { EmailLoginMailer } from './email-login-mailer.js';

describe('EmailLoginMailer', () => {
  it('sends the login code to the admin', async () => {
    const sent: MailMessage[] = [];
    const transport: MailTransport = {
      send: (message) => {
        sent.push(message);
        return Promise.resolve();
      },
    };
    const expiresAt = new Date('2026-01-01T00:15:00Z');

    await new EmailLoginMailer(transport).sendLoginOtp({
      to: Email.create('root@b.co'),
      otp: '654321',
      expiresAt,
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('root@b.co');
    for (const body of [sent[0]?.text, sent[0]?.html]) {
      expect(body).toContain('654321');
      expect(body).toContain(expiresAt.toUTCString());
    }
  });
});
