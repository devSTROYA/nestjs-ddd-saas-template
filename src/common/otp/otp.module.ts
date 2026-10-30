import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/index.js';
import { HmacOtpService } from './hmac-otp.service.js';
import { OTP_SERVICE } from './otp.service.js';

@Module({
  providers: [
    {
      provide: OTP_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): HmacOtpService =>
        new HmacOtpService(config.get('OTP_SECRET', { infer: true })),
    },
  ],
  exports: [OTP_SERVICE],
})
export class OtpModule {}
