import { DomainEvent, type DomainEventProps } from '@common/ddd';

export const RefreshTokenEventNames = {
  ISSUED: 'refresh_token.issued',
  ROTATED: 'refresh_token.rotated',
  FAMILY_REVOKED: 'refresh_token.family_revoked',
} as const;

// INFO: Raised by the repository, not an aggregate: revoking a family updates rows without loading them.
export class RefreshTokenFamilyRevokedEvent extends DomainEvent {
  readonly name = RefreshTokenEventNames.FAMILY_REVOKED;
  readonly revokedTokens: number;

  constructor(props: DomainEventProps & { revokedTokens: number }) {
    super(props);
    this.revokedTokens = props.revokedTokens;
  }
}

export class RefreshTokenIssuedEvent extends DomainEvent {
  readonly name = RefreshTokenEventNames.ISSUED;
  readonly familyId: string;
  readonly principalType: string;

  constructor(props: DomainEventProps & { familyId: string; principalType: string }) {
    super(props);
    this.familyId = props.familyId;
    this.principalType = props.principalType;
  }
}

export class RefreshTokenRotatedEvent extends DomainEvent {
  readonly name = RefreshTokenEventNames.ROTATED;
  readonly familyId: string;

  constructor(props: DomainEventProps & { familyId: string }) {
    super(props);
    this.familyId = props.familyId;
  }
}
