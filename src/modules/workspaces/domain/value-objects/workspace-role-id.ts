import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class WorkspaceRoleId extends UuidV7Id {
  declare private readonly workspaceRoleIdBrand: true;

  static create(): WorkspaceRoleId {
    return new WorkspaceRoleId(newUuidV7());
  }

  static restore(value: string): WorkspaceRoleId {
    return new WorkspaceRoleId(parseUuidV7(value));
  }
}
