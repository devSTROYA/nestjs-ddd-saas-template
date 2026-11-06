import type { WorkspacePermission } from '../../../domain/value-objects/workspace-permission.js';
import type { WorkspaceRoleId } from '../../../domain/value-objects/workspace-role-id.js';

export class CreateWorkspaceRoleCommand {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
    public readonly key: string,
    public readonly name: string,
    public readonly permissions: readonly WorkspacePermission[],
  ) {}
}

export type CreateWorkspaceRoleResult = {
  id: WorkspaceRoleId;
};
