import type { UserId } from '@modules/users';

export class AddWorkspaceMemberCommand {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly roleId: string,
  ) {}
}

export type AddWorkspaceMemberResult = {
  userId: UserId;
};
