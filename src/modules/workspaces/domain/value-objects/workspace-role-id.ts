import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type WorkspaceRoleId = UuidV7Id<'WorkspaceRoleId'>;
export const WorkspaceRoleId = uuidV7IdFactory<WorkspaceRoleId>();
