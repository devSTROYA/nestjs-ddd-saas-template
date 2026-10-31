import { SignJWT, jwtVerify } from 'jose';

import { newUuidV7 } from '@common/primitives';
import type { Nullable } from '@common/types';

import type { AccessToken, TokenService } from '../../application/ports/token.service.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../application/token-lifetimes.js';
import {
  type Principal,
  PrincipalType,
  isPrincipalType,
} from '../../domain/value-objects/principal.js';

const ALGORITHM = 'HS256';
const ISSUER = 'boilerplate-api';
const PRINCIPAL_TYPE_CLAIM = 'principal_type';
const TENANT_ID_CLAIM = 'tenant_id';

export class JoseTokenService implements TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async issueAccessToken(principal: Principal, now: Date): Promise<AccessToken> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const claims = principal.tenantId
      ? { [PRINCIPAL_TYPE_CLAIM]: principal.type, [TENANT_ID_CLAIM]: principal.tenantId }
      : { [PRINCIPAL_TYPE_CLAIM]: principal.type };
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(principal.id)
      .setIssuer(ISSUER)
      .setJti(newUuidV7())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.key);
    return { token, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  async verifyAccessToken(token: string, now: Date): Promise<Nullable<Principal>> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        currentDate: now,
      });
      const type = payload[PRINCIPAL_TYPE_CLAIM];
      if (typeof payload.sub !== 'string' || typeof type !== 'string' || !isPrincipalType(type)) {
        return null;
      }
      const tenantId = payload[TENANT_ID_CLAIM];
      if (type === PrincipalType.USER) {
        return typeof tenantId === 'string' ? { type, id: payload.sub, tenantId } : null;
      }
      return { type, id: payload.sub };
    } catch {
      return null;
    }
  }
}
