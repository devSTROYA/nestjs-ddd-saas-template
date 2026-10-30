import { HttpStatus } from '@nestjs/common';

import { WorkspaceErrorCodes, type WorkspaceErrorCode } from '../domain/errors/domain.error.js';

export const workspaceErrorStatus = {
  [WorkspaceErrorCodes.NAME_EMPTY]: HttpStatus.UNPROCESSABLE_ENTITY,
  [WorkspaceErrorCodes.NAME_TOO_LONG]: HttpStatus.UNPROCESSABLE_ENTITY,
  [WorkspaceErrorCodes.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [WorkspaceErrorCodes.OWNER_REQUIRED]: HttpStatus.FORBIDDEN,
  [WorkspaceErrorCodes.MEMBER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [WorkspaceErrorCodes.MEMBER_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.LAST_OWNER_REQUIRED]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.ROLE_INVALID]: HttpStatus.INTERNAL_SERVER_ERROR,
  [WorkspaceErrorCodes.ID_CONFLICT]: HttpStatus.CONFLICT,
} as const satisfies Record<WorkspaceErrorCode, number>;
