import type { Principal } from '../../domain/value-objects/principal.js';

export interface AccessToken {
  token: string;
  expiresInSeconds: number;
}

export interface TokenService {
  issueAccessToken(principal: Principal, now: Date): Promise<AccessToken>;
  verifyAccessToken(token: string, now: Date): Promise<Principal | null>;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
