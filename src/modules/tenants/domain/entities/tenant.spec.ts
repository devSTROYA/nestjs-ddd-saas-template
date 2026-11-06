import { TenantEventNames } from '../events/tenant.events.js';
import { TenantId } from '../value-objects/tenant-id.js';
import { TenantName } from '../value-objects/tenant-name.js';
import { Tenant } from './tenant.js';

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-02-01T00:00:00Z');

const newTenant = (): Tenant =>
  Tenant.create({ name: TenantName.create('Acme'), createdAt: CREATED_AT });

describe('Tenant', () => {
  it('creates with a generated id, the given name and createdAt', () => {
    const tenant = newTenant();
    expect(TenantId.parse(tenant.id)).toBe(tenant.id);
    expect(tenant.name.value).toBe('Acme');
    expect(tenant.createdAt).toEqual(CREATED_AT);
  });

  it('renames', () => {
    const tenant = newTenant();
    tenant.rename(TenantName.create('Beta'), NOW);
    expect(tenant.name.value).toBe('Beta');
  });

  it('raises created and renamed events, once, stamped with the given times', () => {
    const tenant = newTenant();
    tenant.rename(TenantName.create('Beta'), NOW);

    const events = tenant.pullEvents();

    expect(events).toMatchObject([
      {
        name: TenantEventNames.CREATED,
        aggregateId: tenant.id,
        tenantId: tenant.id,
        tenantName: 'Acme',
        occurredAt: CREATED_AT.toISOString(),
      },
      {
        name: TenantEventNames.RENAMED,
        aggregateId: tenant.id,
        tenantId: tenant.id,
        tenantName: 'Beta',
        occurredAt: NOW.toISOString(),
      },
    ]);
    expect(tenant.pullEvents()).toEqual([]);
  });

  it('raises no event on rehydrate', () => {
    const tenant = Tenant.rehydrate(
      { name: TenantName.rehydrate('Acme'), createdAt: new Date() },
      TenantId.generate(),
    );
    expect(tenant.pullEvents()).toEqual([]);
  });

  it('rehydrates without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const tenant = Tenant.rehydrate(
      { name: TenantName.rehydrate('Acme'), createdAt },
      TenantId.generate(),
    );
    expect(tenant.createdAt).toBe(createdAt);
  });
});
