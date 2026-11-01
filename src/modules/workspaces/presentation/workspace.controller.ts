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
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { ZodValidationPipe } from '@common/validation';
import {
  CurrentPrincipal,
  type Principal,
  PrincipalType,
  RequirePrincipal,
  UnauthenticatedError,
} from '@modules/auth';
import { type TenantId, toTenantId } from '@modules/tenants';
import { type UserId, toUserId } from '@modules/users';

import {
  AddWorkspaceMemberCommand,
  type AddWorkspaceMemberResult,
} from '../application/use-cases/add-workspace-member/add-workspace-member.command.js';
import { ChangeWorkspaceMemberRoleCommand } from '../application/use-cases/change-workspace-member-role/change-workspace-member-role.command.js';
import {
  GetWorkspaceQuery,
  type WorkspaceView,
} from '../application/use-cases/get-workspace/get-workspace.query.js';
import { LeaveWorkspaceCommand } from '../application/use-cases/leave-workspace/leave-workspace.command.js';
import { RemoveWorkspaceMemberCommand } from '../application/use-cases/remove-workspace-member/remove-workspace-member.command.js';
import {
  type AddWorkspaceMemberBody,
  type ChangeWorkspaceMemberRoleBody,
  addWorkspaceMemberBodySchema,
  changeWorkspaceMemberRoleBodySchema,
} from './workspace.schema.js';

type Actor = {
  userId: UserId;
  tenantId: TenantId;
};

// INFO: The tenant always comes from the access token, never from the request.
function actorOf(principal: Principal): Actor {
  if (!principal.tenantId) {
    throw new UnauthenticatedError();
  }
  return { userId: toUserId(principal.id), tenantId: toTenantId(principal.tenantId) };
}

@Controller('workspace')
@RequirePrincipal(PrincipalType.USER)
export class WorkspaceController {
  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
  ) {}

  @Get()
  get(@CurrentPrincipal() principal: Principal): Promise<WorkspaceView> {
    const actor = actorOf(principal);
    return this.queryBus.execute<GetWorkspaceQuery, WorkspaceView>(
      new GetWorkspaceQuery(actor.userId, actor.tenantId),
    );
  }

  @Post('members')
  addMember(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(addWorkspaceMemberBodySchema)) body: AddWorkspaceMemberBody,
  ): Promise<AddWorkspaceMemberResult> {
    const actor = actorOf(principal);
    return this.commandBus.execute<AddWorkspaceMemberCommand, AddWorkspaceMemberResult>(
      new AddWorkspaceMemberCommand(actor.userId, actor.tenantId, body.email, body.name, body.role),
    );
  }

  @Patch('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeRole(
    @CurrentPrincipal() principal: Principal,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(changeWorkspaceMemberRoleBodySchema))
    body: ChangeWorkspaceMemberRoleBody,
  ): Promise<void> {
    const actor = actorOf(principal);
    await this.commandBus.execute<ChangeWorkspaceMemberRoleCommand, void>(
      new ChangeWorkspaceMemberRoleCommand(
        actor.userId,
        actor.tenantId,
        toUserId(userId),
        body.role,
      ),
    );
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param('userId') userId: string,
  ): Promise<void> {
    const actor = actorOf(principal);
    await this.commandBus.execute<RemoveWorkspaceMemberCommand, void>(
      new RemoveWorkspaceMemberCommand(actor.userId, actor.tenantId, toUserId(userId)),
    );
  }

  @Post('leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(@CurrentPrincipal() principal: Principal): Promise<void> {
    const actor = actorOf(principal);
    await this.commandBus.execute<LeaveWorkspaceCommand, void>(
      new LeaveWorkspaceCommand(actor.userId, actor.tenantId),
    );
  }
}
