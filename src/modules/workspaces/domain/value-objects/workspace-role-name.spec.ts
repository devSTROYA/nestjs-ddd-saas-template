import { WorkspaceRoleNameInvalidError } from '../errors/domain.error.js';
import { MAX_WORKSPACE_ROLE_NAME_LENGTH, WorkspaceRoleName } from './workspace-role-name.js';

describe('WorkspaceRoleName', () => {
  it('trims', () => {
    expect(WorkspaceRoleName.create('  Reviewer  ').value).toBe('Reviewer');
  });

  it('rejects an empty name', () => {
    expect(() => WorkspaceRoleName.create('   ')).toThrow(WorkspaceRoleNameInvalidError);
  });

  it('accepts the maximum length and rejects one more', () => {
    expect(WorkspaceRoleName.create('a'.repeat(MAX_WORKSPACE_ROLE_NAME_LENGTH)).value).toHaveLength(
      MAX_WORKSPACE_ROLE_NAME_LENGTH,
    );
    expect(() => WorkspaceRoleName.create('a'.repeat(MAX_WORKSPACE_ROLE_NAME_LENGTH + 1))).toThrow(
      WorkspaceRoleNameInvalidError,
    );
  });

  it('rehydrates a stored name without validating it', () => {
    expect(WorkspaceRoleName.rehydrate('').value).toBe('');
  });

  it('compares by value', () => {
    expect(WorkspaceRoleName.create('Lead').equals(WorkspaceRoleName.create(' Lead '))).toBe(true);
    expect(WorkspaceRoleName.create('Lead').equals(WorkspaceRoleName.create('Other'))).toBe(false);
  });
});
