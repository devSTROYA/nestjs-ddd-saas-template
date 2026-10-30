import { HttpStatus } from '@nestjs/common';

import { AdminErrorCodes, type AdminErrorCode } from '../domain/errors/domain.error.js';

export const adminErrorStatus = {
  [AdminErrorCodes.EMAIL_TAKEN]: HttpStatus.CONFLICT,
} as const satisfies Record<AdminErrorCode, number>;
