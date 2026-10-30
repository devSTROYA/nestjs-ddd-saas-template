import { Sha256RefreshTokenCodec } from './sha256-refresh-token-codec.js';

describe('Sha256RefreshTokenCodec', () => {
  const codec = new Sha256RefreshTokenCodec();

  it('generates url-safe tokens with 256 bits of randomness', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => codec.generate()));

    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('hashes deterministically to 64 hex characters without revealing the token', () => {
    const hash = codec.hash('secret-token');

    expect(hash).toBe(codec.hash('secret-token'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('secret-token');
    expect(codec.hash('other-token')).not.toBe(hash);
  });
});
