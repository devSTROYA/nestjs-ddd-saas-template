import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';

import { HmacOtpService } from './hmac-otp.service.js';
import { otpConfig } from './otp.config.js';
import { OTP_SERVICE } from './otp.service.js';

@Module({
  imports: [ConfigModule.forFeature(otpConfig)],
  providers: [
    {
      provide: OTP_SERVICE,
      inject: [otpConfig.KEY],
      useFactory: (config: ConfigType<typeof otpConfig>): HmacOtpService =>
        new HmacOtpService(config.secret),
    },
  ],
  exports: [OTP_SERVICE],
})
export class OtpModule {}
