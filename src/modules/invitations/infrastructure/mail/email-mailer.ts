import type { MailTransport } from '@common/mail';

import type { Mailer } from '../../application/ports/mailer.js';

export class EmailMailer implements Mailer {
  constructor(private readonly transport: MailTransport) {}

  sendInvitationOtp(message: Parameters<Mailer['sendInvitationOtp']>[0]): Promise<void> {
    const expires = message.expiresAt.toUTCString();
    return this.transport.send({
      to: message.to.value,
      subject: 'You have been invited',
      text: [
        'You have been invited to create a workspace.',
        '',
        `Invitation ID: ${message.invitationId.value}`,
        `One-time code: ${message.otp}`,
        '',
        `Use both to accept the invitation before ${expires}.`,
      ].join('\n'),
      html:
        '<p>You have been invited to create a workspace.</p>' +
        `<p>Invitation ID: <strong>${message.invitationId.value}</strong><br>` +
        `One-time code: <strong>${message.otp}</strong></p>` +
        `<p>Use both to accept the invitation before ${expires}.</p>`,
    });
  }
}
