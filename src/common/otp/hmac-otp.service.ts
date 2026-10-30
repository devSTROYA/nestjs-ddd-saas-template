import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { OTP_DIGITS, type OtpService } from './otp.service.js';

const OTP_SPACE = 10 ** OTP_DIGITS;

export class HmacOtpService implements OtpService {
  constructor(private readonly secret: string) {}

  generate(): string {
    return randomInt(OTP_SPACE).toString().padStart(OTP_DIGITS, '0');
  }

  hash(subjectId: string, otp: string): string {
    return createHmac('sha256', this.secret).update(`${subjectId}:${otp}`).digest('hex');
  }

  matches(subjectId: string, otp: string, hash: string): boolean {
    const expected = Buffer.from(this.hash(subjectId, otp), 'hex');
    const actual = Buffer.from(hash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
