import type { TenantId } from '@modules/tenants';
import type { UserId } from '@modules/users';

import {
  LastWorkspaceOwnerRequiredError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberNotFoundError,
  WorkspaceOwnerRequiredError,
} from '../errors/domain.error.js';
import type { WorkspaceId } from '../value-objects/workspace-id.js';
import type { WorkspaceName } from '../value-objects/workspace-name.js';
import { WorkspaceRole } from '../value-objects/workspace-role.js';

export interface WorkspaceMember {
  userId: UserId;
  role: WorkspaceRole;
}

export class Workspace {
  private constructor(
    public readonly id: WorkspaceId,
    public readonly tenantId: TenantId,
    private _name: WorkspaceName,
    private readonly roles: Map<UserId, WorkspaceRole>,
    public readonly createdAt: Date,
  ) {}

  static create(props: {
    id: WorkspaceId;
    tenantId: TenantId;
    name: WorkspaceName;
    ownerId: UserId;
  }): Workspace {
    return new Workspace(
      props.id,
      props.tenantId,
      props.name,
      new Map([[props.ownerId, WorkspaceRole.OWNER]]),
      new Date(),
    );
  }

  static restore(props: {
    id: WorkspaceId;
    tenantId: TenantId;
    name: WorkspaceName;
    members: readonly WorkspaceMember[];
    createdAt: Date;
  }): Workspace {
    return new Workspace(
      props.id,
      props.tenantId,
      props.name,
      new Map(props.members.map((member) => [member.userId, member.role])),
      props.createdAt,
    );
  }

  get name(): WorkspaceName {
    return this._name;
  }

  get members(): WorkspaceMember[] {
    return [...this.roles].map(([userId, role]) => ({ userId, role }));
  }

  roleOf(userId: UserId): WorkspaceRole | null {
    return this.roles.get(userId) ?? null;
  }

  rename(name: WorkspaceName): void {
    this._name = name;
  }

  assertOwner(userId: UserId): void {
    if (this.roles.get(userId) !== WorkspaceRole.OWNER) {
      throw new WorkspaceOwnerRequiredError();
    }
  }

  addMember(userId: UserId, role: WorkspaceRole): void {
    if (this.roles.has(userId)) {
      throw new WorkspaceMemberAlreadyExistsError(userId);
    }
    this.roles.set(userId, role);
  }

  changeRole(userId: UserId, role: WorkspaceRole): void {
    const current = this.roles.get(userId);
    if (current === undefined) {
      throw new WorkspaceMemberNotFoundError(userId);
    }
    if (current === WorkspaceRole.OWNER && role !== WorkspaceRole.OWNER) {
      this.assertAnotherOwnerExists(userId);
    }
    this.roles.set(userId, role);
  }

  removeMember(userId: UserId): void {
    const current = this.roles.get(userId);
    if (current === undefined) {
      throw new WorkspaceMemberNotFoundError(userId);
    }
    if (current === WorkspaceRole.OWNER) {
      this.assertAnotherOwnerExists(userId);
    }
    this.roles.delete(userId);
  }

  private assertAnotherOwnerExists(except: UserId): void {
    const hasAnotherOwner = [...this.roles].some(
      ([userId, role]) => userId !== except && role === WorkspaceRole.OWNER,
    );
    if (!hasAnotherOwner) {
      throw new LastWorkspaceOwnerRequiredError();
    }
  }
}
