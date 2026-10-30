import { EmptyWorkspaceNameError, WorkspaceNameTooLongError } from '../errors/domain.error.js';

export const MAX_WORKSPACE_NAME_LENGTH = 255;

export class WorkspaceName {
  private constructor(public readonly value: string) {}

  static create(raw: string): WorkspaceName {
    const value = raw.trim();
    if (!value) {
      throw new EmptyWorkspaceNameError();
    }
    if (value.length > MAX_WORKSPACE_NAME_LENGTH) {
      throw new WorkspaceNameTooLongError(MAX_WORKSPACE_NAME_LENGTH);
    }
    return new WorkspaceName(value);
  }

  static restore(value: string): WorkspaceName {
    return new WorkspaceName(value);
  }

  equals(other: WorkspaceName): boolean {
    return this.value === other.value;
  }
}
