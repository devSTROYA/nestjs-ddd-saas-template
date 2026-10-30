import { SignJWT } from 'jose';

import { newAdminId } from '@modules/admins';
import { newTenantId } from '@modules/tenants';

import { ACCESS_TOKEN_TTL_SECONDS } from '../../application/token-lifetimes.js';
import { PrincipalType } from '../../domain/value-objects/principal.js';
import { JoseTokenService } from './jose-token.service.js';

const SECRET = 's'.repeat(32);
const NOW = new Date('2026-01-01T00:00:00Z');
const PRINCIPAL = { type: PrincipalType.ADMIN, id: newAdminId() };

describe('JoseTokenService', () => {
  const service = new JoseTokenService(SECRET);

  it('issues a token that verifies back to the same principal', async () => {
    const { token, expiresInSeconds } = await service.issueAccessToken(PRINCIPAL, NOW);

    expect(expiresInSeconds).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(await service.verifyAccessToken(token, NOW)).toEqual(PRINCIPAL);
  });

  it('carries the tenant of a user and rejects a user token without one', async () => {
    const user = { type: PrincipalType.USER, id: newAdminId(), tenantId: newTenantId() };
    const { token } = await service.issueAccessToken(user, NOW);
    const noTenant = await service.issueAccessToken({ type: PrincipalType.USER, id: user.id }, NOW);

    expect(await service.verifyAccessToken(token, NOW)).toEqual(user);
    expect(await service.verifyAccessToken(noTenant.token, NOW)).toBeNull();
  });

  it('rejects a token once it has expired', async () => {
    const { token } = await service.issueAccessToken(PRINCIPAL, NOW);
    const justExpired = new Date(NOW.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000);

    expect(await service.verifyAccessToken(token, justExpired)).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const { token } = await new JoseTokenService('t'.repeat(32)).issueAccessToken(PRINCIPAL, NOW);

    expect(await service.verifyAccessToken(token, NOW)).toBeNull();
  });

  it('rejects a tampered or malformed token', async () => {
    const { token } = await service.issueAccessToken(PRINCIPAL, NOW);

    expect(await service.verifyAccessToken(`${token}x`, NOW)).toBeNull();
    expect(await service.verifyAccessToken('not-a-jwt', NOW)).toBeNull();
    expect(await service.verifyAccessToken('', NOW)).toBeNull();
  });

  it('rejects a token from another issuer or with an unknown principal type', async () => {
    const key = new TextEncoder().encode(SECRET);
    const sign = (claims: Record<string, unknown>, issuer: string) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(PRINCIPAL.id)
        .setIssuer(issuer)
        .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 60)
        .sign(key);

    expect(
      await service.verifyAccessToken(await sign({ principal_type: 'admin' }, 'someone-else'), NOW),
    ).toBeNull();
    expect(
      await service.verifyAccessToken(
        await sign({ principal_type: 'wizard' }, 'boilerplate-api'),
        NOW,
      ),
    ).toBeNull();
  });
});
