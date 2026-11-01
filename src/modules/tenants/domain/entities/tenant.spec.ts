import { TenantEventNames } from '../events/tenant.events.js';
import { newTenantId } from '../value-objects/tenant-id.js';
import { TenantName } from '../value-objects/tenant-name.js';
import { Tenant } from './tenant.js';

const newTenant = (): Tenant => Tenant.create({ name: TenantName.create('Acme') }, newTenantId());

describe('Tenant', () => {
  it('creates with the given id and name', () => {
    const id = newTenantId();
    const tenant = Tenant.create({ name: TenantName.create('Acme') }, id);
    expect(tenant.id).toBe(id);
    expect(tenant.name.value).toBe('Acme');
  });

  it('renames', () => {
    const tenant = newTenant();
    tenant.rename(TenantName.create('Beta'));
    expect(tenant.name.value).toBe('Beta');
  });

  it('raises created and renamed events, once', () => {
    const tenant = newTenant();
    tenant.rename(TenantName.create('Beta'));

    const events = tenant.pullEvents();

    expect(events).toMatchObject([
      {
        name: TenantEventNames.CREATED,
        aggregateId: tenant.id,
        tenantId: tenant.id,
        tenantName: 'Acme',
      },
      {
        name: TenantEventNames.RENAMED,
        aggregateId: tenant.id,
        tenantId: tenant.id,
        tenantName: 'Beta',
      },
    ]);
    expect(tenant.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const tenant = Tenant.restore(
      { name: TenantName.restore('Acme'), createdAt: new Date() },
      newTenantId(),
    );
    expect(tenant.pullEvents()).toEqual([]);
  });

  it('restores without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const tenant = Tenant.restore({ name: TenantName.restore('Acme'), createdAt }, newTenantId());
    expect(tenant.createdAt).toBe(createdAt);
  });
});
