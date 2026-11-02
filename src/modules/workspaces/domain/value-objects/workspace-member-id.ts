import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class WorkspaceMemberId extends UuidV7Id {
  declare private readonly workspaceMemberIdBrand: true;

  static create(): WorkspaceMemberId {
    return new WorkspaceMemberId(newUuidV7());
  }

  static restore(value: string): WorkspaceMemberId {
    return new WorkspaceMemberId(parseUuidV7(value));
  }
}
