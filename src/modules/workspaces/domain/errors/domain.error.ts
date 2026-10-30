import { DomainError } from '@common/errors';

export const WorkspaceErrorCodes = {
  NAME_EMPTY: 'WORKSPACE_NAME_EMPTY',
  NAME_TOO_LONG: 'WORKSPACE_NAME_TOO_LONG',
  NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  OWNER_REQUIRED: 'WORKSPACE_OWNER_REQUIRED',
  MEMBER_NOT_FOUND: 'WORKSPACE_MEMBER_NOT_FOUND',
  MEMBER_ALREADY_EXISTS: 'WORKSPACE_MEMBER_ALREADY_EXISTS',
  LAST_OWNER_REQUIRED: 'WORKSPACE_LAST_OWNER_REQUIRED',
  ROLE_INVALID: 'WORKSPACE_ROLE_INVALID',
  ID_CONFLICT: 'WORKSPACE_ID_CONFLICT',
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

export class InvalidWorkspaceRoleError extends DomainError {
  constructor(role: string) {
    super(WorkspaceErrorCodes.ROLE_INVALID, `Unknown workspace role: ${role}`);
  }
}
