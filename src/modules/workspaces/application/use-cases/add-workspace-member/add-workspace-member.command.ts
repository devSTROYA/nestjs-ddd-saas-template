import type { UserId } from '@modules/users';

import type { WorkspaceRole } from '../../../domain/value-objects/workspace-role.js';

export class AddWorkspaceMemberCommand {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly workspaceId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly role: WorkspaceRole,
  ) {}
}

export type AddWorkspaceMemberResult = {
  userId: UserId;
};
