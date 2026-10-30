import type { MailMessage, MailTransport } from '@common/mail';
import { Email } from '@common/primitives';

import { newInvitationId } from '../../domain/value-objects/invitation-id.js';
import { EmailMailer } from './email-mailer.js';

describe('EmailMailer', () => {
  it('sends the invitation id and the code to the invitee', async () => {
    const sent: MailMessage[] = [];
    const transport: MailTransport = {
      send: (message) => {
        sent.push(message);
        return Promise.resolve();
      },
    };
    const invitationId = newInvitationId();
    const expiresAt = new Date('2026-01-08T00:00:00Z');

    await new EmailMailer(transport).sendInvitationOtp({
      to: Email.create('owner@acme.co'),
      invitationId,
      otp: '123456',
      expiresAt,
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('owner@acme.co');
    for (const body of [sent[0]?.text, sent[0]?.html]) {
      expect(body).toContain(invitationId);
      expect(body).toContain('123456');
      expect(body).toContain(expiresAt.toUTCString());
    }
  });
});
