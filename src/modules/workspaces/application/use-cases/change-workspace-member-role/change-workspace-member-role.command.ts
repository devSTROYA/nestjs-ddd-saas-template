import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import type { WorkspaceRole } from '../../../domain/value-objects/workspace-role.js';

export class ChangeWorkspaceMemberRoleCommand {
  constructor(
    public readonly actorId: UserId,
    public readonly tenantId: TenantId,
    public readonly workspaceId: WorkspaceId,
    public readonly memberId: UserId,
    public readonly role: WorkspaceRole,
  ) {}
}
