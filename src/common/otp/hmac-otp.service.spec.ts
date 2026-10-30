import { newUuidV7 } from '../primitives/uuid-v7.js';
import { HmacOtpService } from './hmac-otp.service.js';

const SECRET = 's'.repeat(32);

describe('HmacOtpService', () => {
  const service = new HmacOtpService(SECRET);
  const subjectId = newUuidV7();

  it('generates a six digit numeric code', () => {
    for (let i = 0; i < 200; i++) {
      expect(service.generate()).toMatch(/^\d{6}$/);
    }
  });

  it('hashes deterministically to a hex digest', () => {
    expect(service.hash(subjectId, '123456')).toBe(service.hash(subjectId, '123456'));
    expect(service.hash(subjectId, '123456')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches only the same subject, otp and secret', () => {
    const hash = service.hash(subjectId, '123456');

    expect(service.matches(subjectId, '123456', hash)).toBe(true);
    expect(service.matches(subjectId, '654321', hash)).toBe(false);
    expect(service.matches(newUuidV7(), '123456', hash)).toBe(false);
    expect(new HmacOtpService('t'.repeat(32)).matches(subjectId, '123456', hash)).toBe(false);
  });

  it('does not match a malformed stored hash', () => {
    expect(service.matches(subjectId, '123456', '')).toBe(false);
    expect(service.matches(subjectId, '123456', 'not-hex')).toBe(false);
  });
});
