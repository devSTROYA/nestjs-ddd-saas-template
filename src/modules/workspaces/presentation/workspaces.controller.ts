import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { UuidV7ParamPipe, ZodValidationPipe } from '@common/validation';
import {
  CurrentPrincipal,
  type Principal,
  PrincipalType,
  RequirePrincipal,
  UnauthenticatedError,
} from '@modules/auth';

import type { WorkspaceView } from '../application/ports/workspace.query.js';
import {
  AddWorkspaceMemberCommand,
  type AddWorkspaceMemberResult,
} from '../application/use-cases/add-workspace-member/add-workspace-member.command.js';
import { ChangeWorkspaceMemberRoleCommand } from '../application/use-cases/change-workspace-member-role/change-workspace-member-role.command.js';
import { GetWorkspaceQuery } from '../application/use-cases/get-workspace/get-workspace.query.js';
import { LeaveWorkspaceCommand } from '../application/use-cases/leave-workspace/leave-workspace.command.js';
import {
  ListWorkspaceMembersQuery,
  type ListWorkspaceMembersResult,
} from '../application/use-cases/list-workspace-members/list-workspace-members.query.js';
import { RemoveWorkspaceMemberCommand } from '../application/use-cases/remove-workspace-member/remove-workspace-member.command.js';
import {
  type AddWorkspaceMemberBody,
  type ChangeWorkspaceMemberRoleBody,
  type ListWorkspaceMembersQueryParams,
  addWorkspaceMemberBodySchema,
  changeWorkspaceMemberRoleBodySchema,
  listWorkspaceMembersQuerySchema,
} from './workspace.schema.js';

type Actor = {
  userId: string;
  tenantId: string;
};

// INFO: The tenant always comes from the access token, never from the request.
function actorOf(principal: Principal): Actor {
  if (!principal.tenantId) {
    throw new UnauthenticatedError();
  }
  return { userId: principal.id, tenantId: principal.tenantId };
}

@Controller('workspaces')
@RequirePrincipal(PrincipalType.USER)
export class WorkspacesController {
  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  @Get(':workspaceId')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('workspaceId', new UuidV7ParamPipe('workspaceId')) workspaceId: string,
  ): Promise<WorkspaceView> {
    const actor = actorOf(principal);
    return this.queryBus.execute<GetWorkspaceQuery, WorkspaceView>(
      new GetWorkspaceQuery(actor.userId, actor.tenantId, workspaceId),
    );
  }

  @Get(':workspaceId/members')
  listMembers(
    @CurrentPrincipal() principal: Principal,
    @Param('workspaceId', new UuidV7ParamPipe('workspaceId')) workspaceId: string,
    @Query(new ZodValidationPipe(listWorkspaceMembersQuerySchema))
    params: ListWorkspaceMembersQueryParams,
  ): Promise<ListWorkspaceMembersResult> {
    const actor = actorOf(principal);
    return this.queryBus.execute<ListWorkspaceMembersQuery, ListWorkspaceMembersResult>(
      new ListWorkspaceMembersQuery(
        actor.userId,
        actor.tenantId,
        workspaceId,
        params.page,
        params.limit,
      ),
    );
  }

  @Post(':workspaceId/members')
  addMember(
    @CurrentPrincipal() principal: Principal,
    @Param('workspaceId', new UuidV7ParamPipe('workspaceId')) workspaceId: string,
    @Body(new ZodValidationPipe(addWorkspaceMemberBodySchema)) body: AddWorkspaceMemberBody,
  ): Promise<AddWorkspaceMemberResult> {
    const actor = actorOf(principal);
    return this.commandBus.execute<AddWorkspaceMemberCommand, AddWorkspaceMemberResult>(
      new AddWorkspaceMemberCommand(
        actor.userId,
        actor.tenantId,
        workspaceId,
        body.email,
        body.name,
        body.role,
      ),
    );
  }

  @Patch(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeRole(
    @CurrentPrincipal() principal: Principal,
    @Param('workspaceId', new UuidV7ParamPipe('workspaceId')) workspaceId: string,
    @Param('userId', new UuidV7ParamPipe('userId')) userId: string,
    @Body(new ZodValidationPipe(changeWorkspaceMemberRoleBodySchema))
    body: ChangeWorkspaceMemberRoleBody,
  ): Promise<void> {
    const actor = actorOf(principal);
    await this.commandBus.execute<ChangeWorkspaceMemberRoleCommand, void>(
      new ChangeWorkspaceMemberRoleCommand(
        actor.userId,
        actor.tenantId,
        workspaceId,
        userId,
        body.role,
      ),
    );
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param('workspaceId', new UuidV7ParamPipe('workspaceId')) workspaceId: string,
    @Param('userId', new UuidV7ParamPipe('userId')) userId: string,
  ): Promise<void> {
    const actor = actorOf(principal);
    await this.commandBus.execute<RemoveWorkspaceMemberCommand, void>(
      new RemoveWorkspaceMemberCommand(actor.userId, actor.tenantId, workspaceId, userId),
    );
  }

  @Post(':workspaceId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @CurrentPrincipal() principal: Principal,
    @Param('workspaceId', new UuidV7ParamPipe('workspaceId')) workspaceId: string,
  ): Promise<void> {
    const actor = actorOf(principal);
    await this.commandBus.execute<LeaveWorkspaceCommand, void>(
      new LeaveWorkspaceCommand(actor.userId, actor.tenantId, workspaceId),
    );
  }
}
