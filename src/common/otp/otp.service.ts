export const OTP_DIGITS = 6;

export interface OtpService {
  generate(): string;
  hash(subjectId: string, otp: string): string;
  matches(subjectId: string, otp: string, hash: string): boolean;
}

export const OTP_SERVICE = Symbol('OTP_SERVICE');
