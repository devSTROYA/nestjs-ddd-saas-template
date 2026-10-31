import type { Nullable } from '@common/types';

import { MailDeliveryError } from './mail.error.js';
import type { MailMessage, MailTransport } from './mail-transport.js';

export interface ResendClient {
  emails: {
    send(payload: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<{ error: Nullable<{ message: string }> }>;
  };
}

export class ResendMailTransport implements MailTransport {
  constructor(
    private readonly client: ResendClient,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    try {
      const { error } = await this.client.emails.send({ from: this.from, ...message });
      if (error) {
        throw new MailDeliveryError(error.message);
      }
    } catch (error) {
      throw error instanceof MailDeliveryError
        ? error
        : new MailDeliveryError(error instanceof Error ? error.message : 'unknown error');
    }
  }
}
