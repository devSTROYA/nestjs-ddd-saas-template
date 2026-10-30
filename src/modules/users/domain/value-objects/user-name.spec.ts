import { EmptyNameError, UserNameTooLongError } from '../errors/domain.error.js';
import { MAX_USER_NAME_LENGTH, UserName } from './user-name.js';

describe('UserName', () => {
  it('trims on create', () => {
    expect(UserName.create(' Uz ').value).toBe('Uz');
  });

  it('rejects an empty name', () => {
    expect(() => UserName.create('  ')).toThrow(EmptyNameError);
  });

  it('accepts the maximum length and rejects one more', () => {
    expect(UserName.create('a'.repeat(MAX_USER_NAME_LENGTH)).value).toHaveLength(
      MAX_USER_NAME_LENGTH,
    );
    expect(() => UserName.create('a'.repeat(MAX_USER_NAME_LENGTH + 1))).toThrow(
      UserNameTooLongError,
    );
  });

  it('compares by value', () => {
    expect(UserName.create('Uz').equals(UserName.create(' Uz '))).toBe(true);
    expect(UserName.create('Uz').equals(UserName.create('Xy'))).toBe(false);
  });
});
