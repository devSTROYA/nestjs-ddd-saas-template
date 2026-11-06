import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type WorkspaceId = UuidV7Id<'WorkspaceId'>;
export const WorkspaceId = uuidV7IdFactory<WorkspaceId>();
