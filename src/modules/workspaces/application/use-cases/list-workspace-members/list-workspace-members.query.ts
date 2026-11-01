import type { WorkspaceMemberView } from '../../ports/workspace.query.js';

export class ListWorkspaceMembersQuery {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
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
