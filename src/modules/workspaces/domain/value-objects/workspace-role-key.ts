import {
  WorkspaceRoleKeyInvalidError,
  WorkspaceRoleKeyTakenError,
} from '../errors/domain.error.js';
import { SYSTEM_ROLE_KEYS } from './system-workspace-role.js';

export const MAX_WORKSPACE_ROLE_KEY_LENGTH = 32;

const PATTERN = /^[a-z][a-z0-9-]*$/;

// INFO: create is for custom roles, so it refuses a system key. System roles come from storage through rehydrate.
export class WorkspaceRoleKey {
  private constructor(public readonly value: string) {}

  static create(value: string): WorkspaceRoleKey {
    if (value.length > MAX_WORKSPACE_ROLE_KEY_LENGTH || !PATTERN.test(value)) {
      throw new WorkspaceRoleKeyInvalidError(MAX_WORKSPACE_ROLE_KEY_LENGTH);
    }
    if (SYSTEM_ROLE_KEYS.includes(value)) {
      throw new WorkspaceRoleKeyTakenError(value);
    }
    return new WorkspaceRoleKey(value);
  }

  static rehydrate(value: string): WorkspaceRoleKey {
    return new WorkspaceRoleKey(value);
  }

  equals(other: WorkspaceRoleKey): boolean {
    return this.value === other.value;
  }
}
