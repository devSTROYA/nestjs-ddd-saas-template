import { WorkspacePermission } from '../../domain/value-objects/workspace-permission.js';
import {
  knownPermissions,
  toDomain,
  toMutableColumns,
  toPersistence,
} from './workspace-role.mapper.js';
import type { WorkspaceRoleRow } from './workspace-role.schema.js';

const row: WorkspaceRoleRow = {
  id: '0191a2b3-0000-7000-8000-000000000001',
  tenantId: '0191a2b3-0000-7000-8000-000000000002',
  workspaceId: '0191a2b3-0000-7000-8000-000000000003',
  key: 'recruiter',
  name: 'Recruiter',
  createdAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: new Date('2026-02-02T00:00:00Z'),
};

describe('workspace role mapper', () => {
  it('drops a stored permission this version does not know', () => {
    const known = Object.values(WorkspacePermission)[0];

    expect(knownPermissions([known as string, 'workspace:teleport'])).toEqual([known]);
  });

  it('maps a row to the domain and back', () => {
    expect(toPersistence(toDomain(row, []))).toEqual(row);
  });

  it('keeps a system role unscoped', () => {
    const system = { ...row, tenantId: null, workspaceId: null };

    expect(toPersistence(toDomain(system, []))).toMatchObject({
      tenantId: null,
      workspaceId: null,
    });
  });

  it('only exposes the columns a rename may change', () => {
    expect(Object.keys(toMutableColumns(toDomain(row, []))).sort()).toEqual(['name', 'updatedAt']);
  });
});
