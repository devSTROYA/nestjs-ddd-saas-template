import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { NodeRequest } from '@nestjs/platform-node';

import { UnauthenticatedError } from '../domain/errors/domain.error.js';
import type { Principal, PrincipalType } from '../domain/value-objects/principal.js';

export const IS_PUBLIC_KEY = 'auth:is-public';
export const REQUIRED_PRINCIPAL_KEY = 'auth:required-principal';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const RequirePrincipal = (type: PrincipalType) => SetMetadata(REQUIRED_PRINCIPAL_KEY, type);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context.switchToHttp().getRequest<NodeRequest>().principal;
    if (!principal) {
      throw new UnauthenticatedError();
    }
    return principal;
  },
);
