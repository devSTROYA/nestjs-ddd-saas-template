import { Email } from '@common/primitives';
import { Admin, newAdminId } from '@modules/admins';
import { newTenantId } from '@modules/tenants';
import { User, UserName, newUserId } from '@modules/users';

import { InvalidRefreshTokenError } from '../../../domain/errors/domain.error.js';
import { type AuthKit, IP, OTP, createAuthKit } from '../../../testing/fakes.js';
import { REFRESH_TOKEN_TTL_MS } from '../../token-lifetimes.js';
import { RequestAdminLoginCommand } from '../request-admin-login/request-admin-login.command.js';
import { RequestUserLoginCommand } from '../request-user-login/request-user-login.command.js';
import { VerifyAdminLoginCommand } from '../verify-admin-login/verify-admin-login.command.js';
import { VerifyUserLoginCommand } from '../verify-user-login/verify-user-login.command.js';
import { RefreshTokensCommand } from './refresh-tokens.command.js';

const refresh = (kit: AuthKit, refreshToken: string) =>
  kit.refresh.execute(new RefreshTokensCommand(refreshToken));

const loggedIn = async () => {
  const kit = createAuthKit();
  const admin = Admin.create({ email: Email.create('root@b.co') }, newAdminId());
  await kit.admins.save(admin);
  await kit.requestLogin.execute(new RequestAdminLoginCommand('root@b.co'));
  const session = await kit.verifyLogin.execute(new VerifyAdminLoginCommand('root@b.co', OTP, IP));
  return { kit, admin, session };
};

describe('RefreshTokensHandler for tenant users', () => {
  it('rotates a user session, keeping the tenant, and revokes it once the user is gone', async () => {
    const kit = createAuthKit();
    const user = User.create(
      {
        tenantId: newTenantId(),
        email: Email.create('owner@acme.co'),
        name: UserName.create('Owner'),
      },
      newUserId(),
    );
    await kit.users.save(user);
    await kit.requestUserLogin.execute(new RequestUserLoginCommand('owner@acme.co'));
    const session = await kit.verifyUserLogin.execute(
      new VerifyUserLoginCommand('owner@acme.co', OTP, IP),
    );

    const next = await refresh(kit, session.refreshToken);

    expect(next.accessToken).toBe(`access:user:${user.id}:${user.tenantId}`);
    kit.users.saved.clear();
    await expect(refresh(kit, next.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
  });
});

describe('RefreshTokensHandler', () => {
  it('rotates: returns a new pair in the same family and marks the old token used', async () => {
    const { kit, session } = await loggedIn();
    const [first] = [...kit.refreshTokens.saved.values()];

    const next = await refresh(kit, session.refreshToken);

    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(first?.usedAt).toEqual(kit.clock.current);
    const family = kit.refreshTokens.inFamily(first!.familyId);
    expect(family).toHaveLength(2);
    expect(family.filter((token) => token.usedAt === null)).toHaveLength(1);
  });

  it('keeps working along the chain of newest tokens', async () => {
    const { kit, session } = await loggedIn();

    const second = await refresh(kit, session.refreshToken);
    const third = await refresh(kit, second.refreshToken);

    expect(third.refreshToken).not.toBe(second.refreshToken);
  });

  it('revokes the whole family when a used token is presented again', async () => {
    const { kit, session } = await loggedIn();
    const next = await refresh(kit, session.refreshToken);

    await expect(refresh(kit, session.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);

    await expect(refresh(kit, next.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    expect([...kit.refreshTokens.saved.values()].every((token) => token.revokedAt !== null)).toBe(
      true,
    );
  });

  it('rejects an unknown token', async () => {
    const { kit } = await loggedIn();

    await expect(refresh(kit, 'never-issued')).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects an expired token without issuing anything', async () => {
    const { kit, session } = await loggedIn();
    kit.clock.current = new Date(kit.clock.current.getTime() + REFRESH_TOKEN_TTL_MS);

    await expect(refresh(kit, session.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
    expect(kit.refreshTokens.saved.size).toBe(1);
  });

  it('rejects and revokes the session when the admin no longer exists', async () => {
    const { kit, admin, session } = await loggedIn();
    kit.admins.saved.delete(admin.id);

    await expect(refresh(kit, session.refreshToken)).rejects.toThrow(InvalidRefreshTokenError);

    expect([...kit.refreshTokens.saved.values()].every((token) => token.revokedAt !== null)).toBe(
      true,
    );
  });
});
