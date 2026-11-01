import { newUuidV7, parseUuidV7, UuidV7Id } from '@common/primitives';

export class InvitationId extends UuidV7Id {
  declare private readonly invitationIdBrand: true;

  static create(): InvitationId {
    return new InvitationId(newUuidV7());
  }

  static restore(value: string): InvitationId {
    return new InvitationId(parseUuidV7(value));
  }
}
