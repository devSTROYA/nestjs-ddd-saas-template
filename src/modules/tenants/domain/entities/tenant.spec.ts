import { newTenantId } from '../value-objects/tenant-id.js';
import { TenantName } from '../value-objects/tenant-name.js';
import { Tenant } from './tenant.js';

const newTenant = (): Tenant =>
  Tenant.create({ id: newTenantId(), name: TenantName.create('Acme') });

describe('Tenant', () => {
  it('creates with the given id and name', () => {
    const id = newTenantId();
    const tenant = Tenant.create({ id, name: TenantName.create('Acme') });
    expect(tenant.id).toBe(id);
    expect(tenant.name.value).toBe('Acme');
  });

  it('renames', () => {
    const tenant = newTenant();
    tenant.rename(TenantName.create('Beta'));
    expect(tenant.name.value).toBe('Beta');
  });

  it('restores without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const tenant = Tenant.restore({
      id: newTenantId(),
      name: TenantName.restore('Acme'),
      createdAt,
    });
    expect(tenant.createdAt).toBe(createdAt);
  });
});
