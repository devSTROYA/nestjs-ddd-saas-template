import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { WorkspaceEventNames } from '../events/workspace.events.js';
import { WorkspaceId } from '../value-objects/workspace-id.js';
import { WorkspaceName } from '../value-objects/workspace-name.js';
import { Workspace } from './workspace.js';

const OWNER = UserId.generate();
const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const NOW = new Date('2026-01-02T00:00:00Z');

const newWorkspace = (): Workspace =>
  Workspace.create({
    tenantId: TenantId.generate(),
    name: WorkspaceName.create('Acme'),
    ownerId: OWNER,
    createdAt: CREATED_AT,
  });

describe('Workspace', () => {
  it('moves updatedAt forward on rename and leaves createdAt alone', () => {
    const workspace = newWorkspace();
    expect(workspace.createdAt).toEqual(CREATED_AT);
    expect(workspace.updatedAt).toEqual(CREATED_AT);

    workspace.rename(WorkspaceName.create('Renamed'), NOW);

    expect(workspace.name.value).toBe('Renamed');
    expect(workspace.updatedAt).toEqual(NOW);
    expect(workspace.createdAt).toEqual(CREATED_AT);
  });

  it('raises an event for create and rename, once', () => {
    const workspace = newWorkspace();
    expect(workspace.pullEvents()).toMatchObject([
      {
        name: WorkspaceEventNames.CREATED,
        aggregateId: workspace.id,
        tenantId: workspace.tenantId,
        ownerId: OWNER,
        workspaceName: 'Acme',
        occurredAt: CREATED_AT.toISOString(),
      },
    ]);

    workspace.rename(WorkspaceName.create('Beta'), NOW);

    expect(workspace.pullEvents()).toMatchObject([
      { name: WorkspaceEventNames.RENAMED, workspaceName: 'Beta', occurredAt: NOW.toISOString() },
    ]);
    expect(workspace.pullEvents()).toEqual([]);
  });

  it('raises no event on rehydrate', () => {
    const restored = Workspace.rehydrate(
      {
        tenantId: TenantId.generate(),
        name: WorkspaceName.rehydrate('Acme'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      WorkspaceId.generate(),
    );

    expect(restored.pullEvents()).toEqual([]);
  });
});
