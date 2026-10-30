import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import type { Env } from '../config/index.js';
import { LogMailTransport } from './log-mail-transport.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import { ResendMailTransport } from './resend-mail-transport.js';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MailTransport => {
        const apiKey = config.get('RESEND_API_KEY', { infer: true });
        const from = config.get('MAIL_FROM', { infer: true });
        return apiKey && from
          ? new ResendMailTransport(new Resend(apiKey), from)
          : new LogMailTransport();
      },
    },
  ],
  exports: [MAIL_TRANSPORT],
})
export class MailModule {}
