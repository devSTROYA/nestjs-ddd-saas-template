import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import type { WorkspaceId } from '../../../domain/value-objects/workspace-id.js';
import type { WorkspaceMemberView } from '../../ports/workspace.query.js';

export class ListWorkspaceMembersQuery {
  constructor(
    public readonly actorId: UserId,
    public readonly tenantId: TenantId,
    public readonly workspaceId: WorkspaceId,
    public readonly page: number,
    public readonly limit: number,
  ) {}
}

export type ListWorkspaceMembersResult = {
  items: WorkspaceMemberView[];
  page: number;
  limit: number;
  total: number;
};
