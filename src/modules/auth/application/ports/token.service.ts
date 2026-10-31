import type { Nullable } from '@common/types';

import type { Principal } from '../../domain/value-objects/principal.js';

export type AccessToken = {
  token: string;
  expiresInSeconds: number;
};

export interface TokenService {
  issueAccessToken(principal: Principal, now: Date): Promise<AccessToken>;
  verifyAccessToken(token: string, now: Date): Promise<Nullable<Principal>>;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
