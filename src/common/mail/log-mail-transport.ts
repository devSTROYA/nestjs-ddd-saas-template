import { Logger } from '@nestjs/common';

import type { MailMessage, MailTransport } from './mail-transport.js';

export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger(LogMailTransport.name);

  send(message: MailMessage): Promise<void> {
    this.logger.warn(`[mail not sent, no RESEND_API_KEY] to=${message.to}\n${message.text}`);
    return Promise.resolve();
  }
}
