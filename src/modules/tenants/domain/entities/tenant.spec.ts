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
    expect(tenant.id).toBeInstanceOf(TenantId);
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
        aggregateId: tenant.id.value,
        tenantId: tenant.id.value,
        tenantName: 'Acme',
        occurredAt: CREATED_AT.toISOString(),
      },
      {
        name: TenantEventNames.RENAMED,
        aggregateId: tenant.id.value,
        tenantId: tenant.id.value,
        tenantName: 'Beta',
        occurredAt: NOW.toISOString(),
      },
    ]);
    expect(tenant.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const tenant = Tenant.restore(
      { name: TenantName.restore('Acme'), createdAt: new Date() },
      TenantId.create(),
    );
    expect(tenant.pullEvents()).toEqual([]);
  });

  it('restores without re-validation', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const tenant = Tenant.restore(
      { name: TenantName.restore('Acme'), createdAt },
      TenantId.create(),
    );
    expect(tenant.createdAt).toBe(createdAt);
  });
});
