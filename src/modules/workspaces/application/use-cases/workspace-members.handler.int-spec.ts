import { setTimeout } from 'node:timers/promises';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { SystemClock } from '@common/clock';
import { DatabaseContext } from '@common/database';
import { TenantId } from '@modules/tenants';
import { UserId } from '@modules/users';

import { DrizzleUserRepository } from '../../../users/infrastructure/persistence/drizzle-user.repository.js';
import { WorkspaceMember } from '../../domain/entities/workspace-member.js';
import { Workspace } from '../../domain/entities/workspace.js';
import { LastWorkspaceOwnerRequiredError } from '../../domain/errors/domain.error.js';
import type { WorkspaceId } from '../../domain/value-objects/workspace-id.js';
import { WorkspaceName } from '../../domain/value-objects/workspace-name.js';
import { WorkspaceRole } from '../../domain/value-objects/workspace-role.js';
import { DrizzleWorkspaceMemberRepository } from '../../infrastructure/persistence/drizzle-workspace-member.repository.js';
import { DrizzleWorkspaceRepository } from '../../infrastructure/persistence/drizzle-workspace.repository.js';
import { LeaveWorkspaceCommand } from './leave-workspace/leave-workspace.command.js';
import { LeaveWorkspaceHandler } from './leave-workspace/leave-workspace.handler.js';

const OVERLAP_MS = 200;

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const workspaces = new DrizzleWorkspaceRepository(context);

// INFO: Holds each transaction open after it read the count, so without the workspace lock two of them act on the same stale count.
class SlowOwnerCount extends DrizzleWorkspaceMemberRepository {
  override async countOwners(tenantId: TenantId, workspaceId: WorkspaceId): Promise<number> {
    const owners = await super.countOwners(tenantId, workspaceId);
    await setTimeout(OVERLAP_MS);
    return owners;
  }
}

const members = new SlowOwnerCount(context);
const leave = new LeaveWorkspaceHandler(
  workspaces,
  members,
  new DrizzleUserRepository(context),
  context,
  new SystemClock(),
);

const insertUser = async (tenantId: TenantId, email: string): Promise<UserId> => {
  const id = UserId.create();
  await pool.query("INSERT INTO users (id, tenant_id, email, name) VALUES ($1, $2, $3, 'U')", [
    id.value,
    tenantId.value,
    email,
  ]);
  return id;
};

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE outbox, workspace_members, workspaces, users, tenants CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('workspace member handlers under concurrency', () => {
  it('keeps one owner when the only two owners leave at the same time', async () => {
    const tenantId = TenantId.create();
    await pool.query("INSERT INTO tenants (id, name) VALUES ($1, 'T')", [tenantId.value]);
    const first = await insertUser(tenantId, 'a@a.co');
    const second = await insertUser(tenantId, 'b@a.co');
    const workspace = Workspace.create({
      tenantId,
      name: WorkspaceName.create('Acme'),
      ownerId: first,
      createdAt: new Date(),
    });
    await workspaces.save(workspace);
    for (const userId of [first, second]) {
      await members.save(
        WorkspaceMember.create({
          tenantId,
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
          createdAt: new Date(),
        }),
      );
    }

    const results = await Promise.allSettled(
      [first, second].map((userId) =>
        leave.execute(new LeaveWorkspaceCommand(userId.value, tenantId.value, workspace.id.value)),
      ),
    );

    expect(await members.countOwners(tenantId, workspace.id)).toBe(1);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(LastWorkspaceOwnerRequiredError);
  });
});
