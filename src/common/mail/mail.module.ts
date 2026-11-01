import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { Resend } from 'resend';

import { LogMailTransport } from './log-mail-transport.js';
import { mailConfig } from './mail.config.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import { ResendMailTransport } from './resend-mail-transport.js';

@Module({
  imports: [ConfigModule.forFeature(mailConfig)],
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [mailConfig.KEY],
      useFactory: ({ resendApiKey, from }: ConfigType<typeof mailConfig>): MailTransport =>
        resendApiKey && from
          ? new ResendMailTransport(new Resend(resendApiKey), from)
          : new LogMailTransport(),
    },
  ],
  exports: [MAIL_TRANSPORT],
})
export class MailModule {}
