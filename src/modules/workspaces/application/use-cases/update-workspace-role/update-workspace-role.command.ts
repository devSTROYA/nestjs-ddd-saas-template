import type { WorkspacePermission } from '../../../domain/value-objects/workspace-permission.js';

export class UpdateWorkspaceRoleCommand {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
    public readonly roleId: string,
    public readonly name: string,
    public readonly permissions: readonly WorkspacePermission[],
  ) {}
}
