import { Module } from '@nestjs/common';

import { ClockModule } from '@common/clock';
import { DATABASE_CONTEXT, DatabaseModule, type DatabaseContext } from '@common/database';

import { TenantsModule } from '../tenants/tenants.module.js';
import { UsersModule } from '../users/users.module.js';
import { WORKSPACE_QUERY } from './application/ports/workspace.query.js';
import { WORKSPACE_REPOSITORY } from './application/ports/workspace.repository.js';
import { AddWorkspaceMemberHandler } from './application/use-cases/add-workspace-member/add-workspace-member.handler.js';
import { ChangeWorkspaceMemberRoleHandler } from './application/use-cases/change-workspace-member-role/change-workspace-member-role.handler.js';
import { GetWorkspaceHandler } from './application/use-cases/get-workspace/get-workspace.handler.js';
import { LeaveWorkspaceHandler } from './application/use-cases/leave-workspace/leave-workspace.handler.js';
import { ListWorkspaceMembersHandler } from './application/use-cases/list-workspace-members/list-workspace-members.handler.js';
import { RemoveWorkspaceMemberHandler } from './application/use-cases/remove-workspace-member/remove-workspace-member.handler.js';
import { DrizzleWorkspaceQuery } from './infrastructure/persistence/drizzle-workspace.query.js';
import { DrizzleWorkspaceRepository } from './infrastructure/persistence/drizzle-workspace.repository.js';
import { WorkspacesController } from './presentation/workspaces.controller.js';

@Module({
  imports: [ClockModule, DatabaseModule, TenantsModule, UsersModule],
  controllers: [WorkspacesController],
  providers: [
    {
      provide: WORKSPACE_REPOSITORY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleWorkspaceRepository =>
        new DrizzleWorkspaceRepository(context),
    },
    {
      provide: WORKSPACE_QUERY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleWorkspaceQuery =>
        new DrizzleWorkspaceQuery(context),
    },
    GetWorkspaceHandler,
    ListWorkspaceMembersHandler,
    AddWorkspaceMemberHandler,
    ChangeWorkspaceMemberRoleHandler,
    RemoveWorkspaceMemberHandler,
    LeaveWorkspaceHandler,
  ],
  exports: [WORKSPACE_REPOSITORY],
})
export class WorkspacesModule {}
