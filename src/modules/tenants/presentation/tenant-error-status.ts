import { HttpStatus } from '@nestjs/common';

import { TenantErrorCodes, type TenantErrorCode } from '../domain/errors/domain.error.js';

export const tenantErrorStatus = {
  [TenantErrorCodes.NAME_EMPTY]: HttpStatus.UNPROCESSABLE_ENTITY,
  [TenantErrorCodes.NAME_TOO_LONG]: HttpStatus.UNPROCESSABLE_ENTITY,
} as const satisfies Record<TenantErrorCode, number>;
