import { Inject, Injectable } from '@nestjs/common';

import { RefreshToken } from '../domain/entities/refresh-token.js';
import { type TokenFamilyId, newRefreshTokenId } from '../domain/value-objects/ids.js';
import type { Principal } from '../domain/value-objects/principal.js';
import { REFRESH_TOKEN_CODEC, type RefreshTokenCodec } from './ports/refresh-token-codec.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './ports/refresh-token.repository.js';
import { TOKEN_SERVICE, type TokenService } from './ports/token.service.js';
import { REFRESH_TOKEN_TTL_MS } from './token-lifetimes.js';

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

@Injectable()
export class SessionService {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(REFRESH_TOKEN_CODEC) private readonly codec: RefreshTokenCodec,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async issue(principal: Principal, familyId: TokenFamilyId, now: Date): Promise<Session> {
    const refreshToken = this.codec.generate();
    await this.refreshTokens.save(
      RefreshToken.issue(
        {
          familyId,
          principal,
          tokenHash: this.codec.hash(refreshToken),
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
        },
        newRefreshTokenId(),
        now,
      ),
    );
    const access = await this.tokens.issueAccessToken(principal, now);
    return {
      accessToken: access.token,
      refreshToken,
      expiresInSeconds: access.expiresInSeconds,
    };
  }
}
