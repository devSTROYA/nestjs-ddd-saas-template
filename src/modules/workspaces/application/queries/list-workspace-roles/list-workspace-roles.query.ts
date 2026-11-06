export class ListWorkspaceRolesQuery {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
  ) {}
}
