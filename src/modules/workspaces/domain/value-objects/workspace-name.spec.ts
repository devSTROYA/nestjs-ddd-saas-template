import { EmptyWorkspaceNameError, WorkspaceNameTooLongError } from '../errors/domain.error.js';
import { MAX_WORKSPACE_NAME_LENGTH, WorkspaceName } from './workspace-name.js';

describe('WorkspaceName', () => {
  it('trims', () => {
    expect(WorkspaceName.create('  Acme  ').value).toBe('Acme');
  });

  it('rejects an empty name', () => {
    expect(() => WorkspaceName.create('   ')).toThrow(EmptyWorkspaceNameError);
  });

  it('accepts the maximum length and rejects one more', () => {
    expect(WorkspaceName.create('a'.repeat(MAX_WORKSPACE_NAME_LENGTH)).value).toHaveLength(
      MAX_WORKSPACE_NAME_LENGTH,
    );
    expect(() => WorkspaceName.create('a'.repeat(MAX_WORKSPACE_NAME_LENGTH + 1))).toThrow(
      WorkspaceNameTooLongError,
    );
  });

  it('compares by value', () => {
    expect(WorkspaceName.create('Acme').equals(WorkspaceName.create(' Acme '))).toBe(true);
    expect(WorkspaceName.create('Acme').equals(WorkspaceName.create('Beta'))).toBe(false);
  });
});
