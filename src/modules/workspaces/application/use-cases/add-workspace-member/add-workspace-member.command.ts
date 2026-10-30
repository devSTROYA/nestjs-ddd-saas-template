import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceRole } from '../../../domain/value-objects/workspace-role.js';

export class AddWorkspaceMemberCommand {
  constructor(
    public readonly actorId: UserId,
    public readonly tenantId: TenantId,
    public readonly email: string,
    public readonly name: string,
    public readonly role: WorkspaceRole,
  ) {}
}

export interface AddWorkspaceMemberResult {
  userId: UserId;
}
