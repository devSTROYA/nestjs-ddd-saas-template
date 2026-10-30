import { Email } from '@common/primitives';
import { Admin, newAdminId } from '@modules/admins';

import { InvalidRefreshTokenError } from '../../../domain/errors/domain.error.js';
import { IP, OTP, createAuthKit } from '../../../testing/fakes.js';
import { RefreshTokensCommand } from '../refresh-tokens/refresh-tokens.command.js';
import { RequestAdminLoginCommand } from '../request-admin-login/request-admin-login.command.js';
import { VerifyAdminLoginCommand } from '../verify-admin-login/verify-admin-login.command.js';
import { LogoutCommand } from './logout.command.js';

const loggedIn = async () => {
  const kit = createAuthKit();
  await kit.admins.save(Admin.create({ id: newAdminId(), email: Email.create('root@b.co') }));
  await kit.requestLogin.execute(new RequestAdminLoginCommand('root@b.co'));
  const session = await kit.verifyLogin.execute(new VerifyAdminLoginCommand('root@b.co', OTP, IP));
  return { kit, session };
};

describe('LogoutHandler', () => {
  it('revokes the whole session so no token of the family can be refreshed', async () => {
    const { kit, session } = await loggedIn();
    const next = await kit.refresh.execute(new RefreshTokensCommand(session.refreshToken));

    await kit.logout.execute(new LogoutCommand(next.refreshToken));

    await expect(kit.refresh.execute(new RefreshTokensCommand(next.refreshToken))).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    expect([...kit.refreshTokens.saved.values()].every((token) => token.revokedAt !== null)).toBe(
      true,
    );
  });

  it('ignores an unknown token', async () => {
    const { kit } = await loggedIn();

    await expect(kit.logout.execute(new LogoutCommand('never-issued'))).resolves.toBeUndefined();
    expect([...kit.refreshTokens.saved.values()].every((token) => token.revokedAt === null)).toBe(
      true,
    );
  });
});
