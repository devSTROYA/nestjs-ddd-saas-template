import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';

export class RemoveWorkspaceMemberCommand {
  constructor(
    public readonly actorId: UserId,
    public readonly tenantId: TenantId,
    public readonly workspaceId: WorkspaceId,
    public readonly memberId: UserId,
  ) {}
}
