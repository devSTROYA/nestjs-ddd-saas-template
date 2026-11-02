export class DeleteWorkspaceRoleCommand {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
    public readonly roleId: string,
  ) {}
}
