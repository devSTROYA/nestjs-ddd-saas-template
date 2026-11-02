import { WatchedList } from '@common/ddd';

import type { WorkspacePermission } from '../value-objects/workspace-permission.js';

export class WorkspacePermissionList extends WatchedList<WorkspacePermission> {
  protected compareItems(a: WorkspacePermission, b: WorkspacePermission): boolean {
    return a === b;
  }
}
