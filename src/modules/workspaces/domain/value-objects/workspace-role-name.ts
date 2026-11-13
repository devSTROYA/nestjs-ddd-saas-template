import { WorkspaceRoleNameInvalidError } from '../errors/domain.error.js';

export const MAX_WORKSPACE_ROLE_NAME_LENGTH = 64;

export class WorkspaceRoleName {
  private constructor(public readonly value: string) {}

  static create(raw: string): WorkspaceRoleName {
    const value = raw.trim();
    if (!value || value.length > MAX_WORKSPACE_ROLE_NAME_LENGTH) {
      throw new WorkspaceRoleNameInvalidError(MAX_WORKSPACE_ROLE_NAME_LENGTH);
    }
    return new WorkspaceRoleName(value);
  }

  static rehydrate(value: string): WorkspaceRoleName {
    return new WorkspaceRoleName(value);
  }

  equals(other: WorkspaceRoleName): boolean {
    return this.value === other.value;
  }
}
