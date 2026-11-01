import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';

export class LeaveWorkspaceCommand {
  constructor(
    public readonly actorId: UserId,
    public readonly tenantId: TenantId,
    public readonly workspaceId: WorkspaceId,
  ) {}
}
