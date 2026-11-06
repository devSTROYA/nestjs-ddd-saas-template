export class ChangeWorkspaceMemberRoleCommand {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
    public readonly memberId: string,
    public readonly roleId: string,
  ) {}
}
