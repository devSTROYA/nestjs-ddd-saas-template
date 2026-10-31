import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceMember } from '../../../domain/entities/workspace.js';
import type { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import type { WorkspaceRole } from '../../../domain/value-objects/workspace-role.js';

export class GetWorkspaceQuery {
  constructor(
    public readonly actorId: UserId,
    public readonly tenantId: TenantId,
  ) {}
}

export type WorkspaceView = {
  id: WorkspaceId;
  name: string;
  role: WorkspaceRole;
  members: WorkspaceMember[];
};
