import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class WorkspaceId extends UuidV7Id {
  declare private readonly workspaceIdBrand: true;

  static create(): WorkspaceId {
    return new WorkspaceId(newUuidV7());
  }

  static restore(value: string): WorkspaceId {
    return new WorkspaceId(parseUuidV7(value));
  }
}
