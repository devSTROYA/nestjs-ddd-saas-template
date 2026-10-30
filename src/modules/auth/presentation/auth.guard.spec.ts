import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ForbiddenError, UnauthenticatedError } from '../domain/errors/domain.error.js';
import { PrincipalType } from '../domain/value-objects/principal.js';
import { FakeTokenService, MutableClock, NOW } from '../testing/fakes.js';
import { Public, RequirePrincipal } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';

@Public()
class OpenController {
  handler(): void {}
}

class ClosedController {
  handler(): void {}
}

class AdminController {
  @RequirePrincipal(PrincipalType.ADMIN)
  handler(): void {}
}

class StrangerController {
  @RequirePrincipal('stranger' as PrincipalType)
  handler(): void {}
}

const ADMIN_TOKEN = 'access:admin:0198f0a2-0000-7000-8000-000000000001';

const contextFor = (
  controller: new () => { handler(): void },
  authorization?: string,
): {
  context: ExecutionContext;
  request: { headers: Record<string, string | undefined>; principal?: unknown };
} => {
  const request = { headers: { authorization } } as {
    headers: Record<string, string | undefined>;
    principal?: unknown;
  };
  const context = {
    getHandler: () => controller.prototype.handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
};

const guard = new AuthGuard(new Reflector(), new FakeTokenService(), new MutableClock(NOW));

describe('AuthGuard', () => {
  it('lets a public route through without a token', async () => {
    await expect(guard.canActivate(contextFor(OpenController).context)).resolves.toBe(true);
  });

  it('rejects a protected route without a token', async () => {
    await expect(guard.canActivate(contextFor(ClosedController).context)).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  it.each(['Basic abc', 'Bearer', 'Bearer not-a-token', ADMIN_TOKEN])(
    'rejects a header that is not a valid bearer token: %s',
    async (header) => {
      await expect(guard.canActivate(contextFor(ClosedController, header).context)).rejects.toThrow(
        UnauthenticatedError,
      );
    },
  );

  it('accepts a valid bearer token, in any letter case of the scheme, and exposes the principal', async () => {
    const { context, request } = contextFor(ClosedController, `bEaReR ${ADMIN_TOKEN}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal).toEqual({
      type: PrincipalType.ADMIN,
      id: '0198f0a2-0000-7000-8000-000000000001',
    });
  });

  it('lets the required principal type through and rejects any other type', async () => {
    await expect(
      guard.canActivate(contextFor(AdminController, `Bearer ${ADMIN_TOKEN}`).context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(StrangerController, `Bearer ${ADMIN_TOKEN}`).context),
    ).rejects.toThrow(ForbiddenError);
  });
});
