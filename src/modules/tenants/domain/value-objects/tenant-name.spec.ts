import { EmptyTenantNameError, TenantNameTooLongError } from '../errors/domain.error.js';
import { MAX_TENANT_NAME_LENGTH, TenantName } from './tenant-name.js';

describe('TenantName', () => {
  it('trims on create', () => {
    expect(TenantName.create('  Acme  ').value).toBe('Acme');
  });

  it('rejects an empty name', () => {
    expect(() => TenantName.create('   ')).toThrow(EmptyTenantNameError);
  });

  it('accepts the maximum length and rejects one more', () => {
    expect(TenantName.create('a'.repeat(MAX_TENANT_NAME_LENGTH)).value).toHaveLength(
      MAX_TENANT_NAME_LENGTH,
    );
    expect(() => TenantName.create('a'.repeat(MAX_TENANT_NAME_LENGTH + 1))).toThrow(
      TenantNameTooLongError,
    );
  });

  it('compares by value', () => {
    expect(TenantName.create('Acme').equals(TenantName.create(' Acme '))).toBe(true);
    expect(TenantName.create('Acme').equals(TenantName.create('Beta'))).toBe(false);
  });
});
