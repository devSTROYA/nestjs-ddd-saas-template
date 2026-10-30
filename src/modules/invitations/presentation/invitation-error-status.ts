import { HttpStatus } from '@nestjs/common';

import { InvitationErrorCodes, type InvitationErrorCode } from '../domain/errors/domain.error.js';

export const invitationErrorStatus = {
  [InvitationErrorCodes.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [InvitationErrorCodes.NOT_PENDING]: HttpStatus.CONFLICT,
  [InvitationErrorCodes.ALREADY_PENDING]: HttpStatus.CONFLICT,
  [InvitationErrorCodes.EMAIL_ALREADY_REGISTERED]: HttpStatus.CONFLICT,
  [InvitationErrorCodes.EXPIRED]: HttpStatus.GONE,
  [InvitationErrorCodes.LOCKED]: HttpStatus.TOO_MANY_REQUESTS,
  [InvitationErrorCodes.OTP_INVALID]: HttpStatus.UNPROCESSABLE_ENTITY,
  [InvitationErrorCodes.STATUS_INVALID]: HttpStatus.INTERNAL_SERVER_ERROR,
} as const satisfies Record<InvitationErrorCode, number>;
