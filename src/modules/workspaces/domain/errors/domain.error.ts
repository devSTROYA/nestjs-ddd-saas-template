import { DomainError } from '@common/errors';

export const WorkspaceErrorCodes = {
  NAME_EMPTY: 'WORKSPACE_NAME_EMPTY',
  NAME_TOO_LONG: 'WORKSPACE_NAME_TOO_LONG',
  NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  OWNER_REQUIRED: 'WORKSPACE_OWNER_REQUIRED',
  PERMISSION_DENIED: 'WORKSPACE_PERMISSION_DENIED',
  MEMBER_NOT_FOUND: 'WORKSPACE_MEMBER_NOT_FOUND',
  MEMBER_ALREADY_EXISTS: 'WORKSPACE_MEMBER_ALREADY_EXISTS',
  LAST_OWNER_REQUIRED: 'WORKSPACE_LAST_OWNER_REQUIRED',
  ID_CONFLICT: 'WORKSPACE_ID_CONFLICT',
  MEMBER_ID_CONFLICT: 'WORKSPACE_MEMBER_ID_CONFLICT',
  ROLE_NOT_FOUND: 'WORKSPACE_ROLE_NOT_FOUND',
  ROLE_KEY_INVALID: 'WORKSPACE_ROLE_KEY_INVALID',
  ROLE_KEY_TAKEN: 'WORKSPACE_ROLE_KEY_TAKEN',
  ROLE_NAME_INVALID: 'WORKSPACE_ROLE_NAME_INVALID',
  ROLE_IN_USE: 'WORKSPACE_ROLE_IN_USE',
  ROLE_SYSTEM: 'WORKSPACE_ROLE_SYSTEM',
  ROLE_ID_CONFLICT: 'WORKSPACE_ROLE_ID_CONFLICT',
} as const;

export type WorkspaceErrorCode = (typeof WorkspaceErrorCodes)[keyof typeof WorkspaceErrorCodes];

export class EmptyWorkspaceNameError extends DomainError {
  constructor() {
    super(WorkspaceErrorCodes.NAME_EMPTY, 'Workspace name is required');
  }
}

export class WorkspaceNameTooLongError extends DomainError {
  constructor(maxLength: number) {
    super(
      WorkspaceErrorCodes.NAME_TOO_LONG,
      `Workspace name must be at most ${maxLength} characters`,
    );
  }
}

export class WorkspaceNotFoundError extends DomainError {
  constructor() {
    super(WorkspaceErrorCodes.NOT_FOUND, 'Workspace not found');
  }
}

export class WorkspaceOwnerRequiredError extends DomainError {
  constructor() {
    super(WorkspaceErrorCodes.OWNER_REQUIRED, 'Only an owner of the workspace may do this');
  }
}

export class WorkspacePermissionDeniedError extends DomainError {
  constructor(missing: readonly string[]) {
    super(WorkspaceErrorCodes.PERMISSION_DENIED, 'Missing workspace permission', { missing });
  }
}

export class WorkspaceMemberNotFoundError extends DomainError {
  constructor(userId: string) {
    super(WorkspaceErrorCodes.MEMBER_NOT_FOUND, `User is not a member of the workspace: ${userId}`);
  }
}

export class WorkspaceMemberAlreadyExistsError extends DomainError {
  constructor(userId: string) {
    super(
      WorkspaceErrorCodes.MEMBER_ALREADY_EXISTS,
      `User is already a member of the workspace: ${userId}`,
    );
  }
}

export class LastWorkspaceOwnerRequiredError extends DomainError {
  constructor() {
    super(
      WorkspaceErrorCodes.LAST_OWNER_REQUIRED,
      'A workspace needs at least one owner, make someone else an owner first',
    );
  }
}

export class WorkspaceIdConflictError extends DomainError {
  constructor(workspaceId: string) {
    super(
      WorkspaceErrorCodes.ID_CONFLICT,
      `Workspace id already belongs to another tenant: ${workspaceId}`,
    );
  }
}

export class WorkspaceMemberIdConflictError extends DomainError {
  constructor(memberId: string) {
    super(
      WorkspaceErrorCodes.MEMBER_ID_CONFLICT,
      `Workspace member id already belongs to another tenant: ${memberId}`,
    );
  }
}

export class WorkspaceRoleNotFoundError extends DomainError {
  constructor(roleId: string) {
    super(WorkspaceErrorCodes.ROLE_NOT_FOUND, `Unknown workspace role: ${roleId}`);
  }
}

export class WorkspaceRoleKeyInvalidError extends DomainError {
  constructor(maxLength: number) {
    super(
      WorkspaceErrorCodes.ROLE_KEY_INVALID,
      `Role key must be lowercase letters, digits or dashes, start with a letter and be at most ${maxLength} characters`,
    );
  }
}

export class WorkspaceRoleKeyTakenError extends DomainError {
  constructor(key: string) {
    super(WorkspaceErrorCodes.ROLE_KEY_TAKEN, `Role key is already taken: ${key}`);
  }
}

export class WorkspaceRoleNameInvalidError extends DomainError {
  constructor(maxLength: number) {
    super(
      WorkspaceErrorCodes.ROLE_NAME_INVALID,
      `Role name is required and must be at most ${maxLength} characters`,
    );
  }
}

export class WorkspaceRoleInUseError extends DomainError {
  constructor(key: string) {
    super(WorkspaceErrorCodes.ROLE_IN_USE, `Role still has members: ${key}`);
  }
}

export class SystemWorkspaceRoleError extends DomainError {
  constructor(key: string) {
    super(WorkspaceErrorCodes.ROLE_SYSTEM, `System role cannot be changed: ${key}`);
  }
}

export class WorkspaceRoleIdConflictError extends DomainError {
  constructor(roleId: string) {
    super(
      WorkspaceErrorCodes.ROLE_ID_CONFLICT,
      `Workspace role id already belongs to another tenant: ${roleId}`,
    );
  }
}
