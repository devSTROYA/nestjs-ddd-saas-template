export class GetWorkspaceQuery {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
  ) {}
}
