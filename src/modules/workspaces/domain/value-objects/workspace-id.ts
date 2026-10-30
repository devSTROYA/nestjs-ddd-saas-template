import { newUuidV7, parseUuidV7 } from '@common/primitives';

declare const workspaceIdBrand: unique symbol;

export type WorkspaceId = string & { readonly [workspaceIdBrand]: true };

export function toWorkspaceId(value: string): WorkspaceId {
  return parseUuidV7(value) as WorkspaceId;
}

export function newWorkspaceId(): WorkspaceId {
  return newUuidV7() as WorkspaceId;
}
