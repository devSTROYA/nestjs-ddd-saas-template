import {
  WorkspaceRoleKeyInvalidError,
  WorkspaceRoleKeyTakenError,
} from '../errors/domain.error.js';
import { MAX_WORKSPACE_ROLE_KEY_LENGTH, WorkspaceRoleKey } from './workspace-role-key.js';

describe('WorkspaceRoleKey', () => {
  it('accepts lowercase letters, digits and dashes that start with a letter', () => {
    expect(WorkspaceRoleKey.create('reviewer-2').value).toBe('reviewer-2');
  });

  it.each(['Not Valid', '1abc', '-abc', 'Upper', 'under_score', ''])('rejects %s', (key) => {
    expect(() => WorkspaceRoleKey.create(key)).toThrow(WorkspaceRoleKeyInvalidError);
  });

  it('accepts the maximum length and rejects one more', () => {
    expect(WorkspaceRoleKey.create('a'.repeat(MAX_WORKSPACE_ROLE_KEY_LENGTH)).value).toHaveLength(
      MAX_WORKSPACE_ROLE_KEY_LENGTH,
    );
    expect(() => WorkspaceRoleKey.create('a'.repeat(MAX_WORKSPACE_ROLE_KEY_LENGTH + 1))).toThrow(
      WorkspaceRoleKeyInvalidError,
    );
  });

  it.each(['owner', 'admin', 'member'])('refuses the system key %s on create', (key) => {
    expect(() => WorkspaceRoleKey.create(key)).toThrow(WorkspaceRoleKeyTakenError);
  });

  it('rehydrates a system key from storage', () => {
    expect(WorkspaceRoleKey.rehydrate('owner').value).toBe('owner');
  });

  it('compares by value', () => {
    expect(WorkspaceRoleKey.create('lead').equals(WorkspaceRoleKey.create('lead'))).toBe(true);
    expect(WorkspaceRoleKey.create('lead').equals(WorkspaceRoleKey.create('other'))).toBe(false);
  });
});
