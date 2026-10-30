import { HttpStatus } from '@nestjs/common';

import { UserErrorCodes, type UserErrorCode } from '../domain/errors/domain.error.js';

export const userErrorStatus = {
  [UserErrorCodes.NAME_EMPTY]: HttpStatus.UNPROCESSABLE_ENTITY,
  [UserErrorCodes.NAME_TOO_LONG]: HttpStatus.UNPROCESSABLE_ENTITY,
  [UserErrorCodes.EMAIL_TAKEN]: HttpStatus.CONFLICT,
  [UserErrorCodes.ID_CONFLICT]: HttpStatus.CONFLICT,
} as const satisfies Record<UserErrorCode, number>;
