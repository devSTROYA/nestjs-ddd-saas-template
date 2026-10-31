import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { CLOCK, type Clock } from '@common/clock';
import type { Nullable } from '@common/types';

import { TOKEN_SERVICE, type TokenService } from '../application/ports/token.service.js';
import { ForbiddenError, UnauthenticatedError } from '../domain/errors/domain.error.js';
import type { Principal, PrincipalType } from '../domain/value-objects/principal.js';
import { IS_PUBLIC_KEY, REQUIRED_PRINCIPAL_KEY } from './auth.decorators.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

const BEARER_SCHEME = 'bearer';

function bearerToken(header: string | undefined): Nullable<string> {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === BEARER_SCHEME && token ? token : null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = bearerToken(request.headers.authorization);
    const principal = token ? await this.tokens.verifyAccessToken(token, this.clock.now()) : null;
    if (!principal) {
      throw new UnauthenticatedError();
    }

    const required = this.reflector.getAllAndOverride<PrincipalType | undefined>(
      REQUIRED_PRINCIPAL_KEY,
      targets,
    );
    if (required && principal.type !== required) {
      throw new ForbiddenError();
    }
    request.principal = principal;
    return true;
  }
}
