import { HttpStatus } from '@nestjs/common';

import { AuthErrorCodes, type AuthErrorCode } from '../domain/errors/domain.error.js';

export const authErrorStatus = {
  [AuthErrorCodes.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [AuthErrorCodes.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [AuthErrorCodes.CREDENTIALS_INVALID]: HttpStatus.UNAUTHORIZED,
  [AuthErrorCodes.REFRESH_TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
  [AuthErrorCodes.CHALLENGE_ALREADY_PENDING]: HttpStatus.CONFLICT,
  [AuthErrorCodes.CHALLENGE_STATUS_INVALID]: HttpStatus.INTERNAL_SERVER_ERROR,
  [AuthErrorCodes.PRINCIPAL_TYPE_INVALID]: HttpStatus.INTERNAL_SERVER_ERROR,
} as const satisfies Record<AuthErrorCode, number>;
