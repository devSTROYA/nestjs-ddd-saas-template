import { HttpStatus } from '@nestjs/common';

import { WorkspaceErrorCodes, type WorkspaceErrorCode } from '../domain/errors/domain.error.js';

export const workspaceErrorStatus = {
  [WorkspaceErrorCodes.NAME_EMPTY]: HttpStatus.UNPROCESSABLE_ENTITY,
  [WorkspaceErrorCodes.NAME_TOO_LONG]: HttpStatus.UNPROCESSABLE_ENTITY,
  [WorkspaceErrorCodes.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [WorkspaceErrorCodes.OWNER_REQUIRED]: HttpStatus.FORBIDDEN,
  [WorkspaceErrorCodes.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [WorkspaceErrorCodes.MEMBER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [WorkspaceErrorCodes.MEMBER_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.LAST_OWNER_REQUIRED]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.ID_CONFLICT]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.MEMBER_ID_CONFLICT]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.ROLE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [WorkspaceErrorCodes.ROLE_KEY_INVALID]: HttpStatus.UNPROCESSABLE_ENTITY,
  [WorkspaceErrorCodes.ROLE_KEY_TAKEN]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.ROLE_NAME_INVALID]: HttpStatus.UNPROCESSABLE_ENTITY,
  [WorkspaceErrorCodes.ROLE_IN_USE]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.ROLE_SYSTEM]: HttpStatus.CONFLICT,
  [WorkspaceErrorCodes.ROLE_ID_CONFLICT]: HttpStatus.CONFLICT,
} as const satisfies Record<WorkspaceErrorCode, number>;
