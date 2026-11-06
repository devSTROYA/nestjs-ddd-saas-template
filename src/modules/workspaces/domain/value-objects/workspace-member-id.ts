import { type UuidV7Id, uuidV7IdFactory } from '@common/primitives';

export type WorkspaceMemberId = UuidV7Id<'WorkspaceMemberId'>;
export const WorkspaceMemberId = uuidV7IdFactory<WorkspaceMemberId>();
