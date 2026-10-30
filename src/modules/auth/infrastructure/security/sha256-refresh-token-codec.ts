import { createHash, randomBytes } from 'node:crypto';

import type { RefreshTokenCodec } from '../../application/ports/refresh-token-codec.js';

const TOKEN_BYTES = 32;

export class Sha256RefreshTokenCodec implements RefreshTokenCodec {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
