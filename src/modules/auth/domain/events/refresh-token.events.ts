import { DomainEvent } from '@common/ddd';
import type { Nullable } from '@common/types';

export const RefreshTokenEventNames = {
  ISSUED: 'refresh_token.issued',
  ROTATED: 'refresh_token.rotated',
  FAMILY_REVOKED: 'refresh_token.family_revoked',
} as const;

// Raised by the repository, not an aggregate: revoking a family updates many rows without loading them.
export class RefreshTokenFamilyRevokedEvent extends DomainEvent {
  readonly name = RefreshTokenEventNames.FAMILY_REVOKED;

  constructor(
    familyId: string,
    occurredAt: string,
    public readonly revokedTokens: number,
  ) {
    super(familyId, null, occurredAt);
  }
}

export class RefreshTokenIssuedEvent extends DomainEvent {
  readonly name = RefreshTokenEventNames.ISSUED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    public readonly familyId: string,
    public readonly principalType: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}

export class RefreshTokenRotatedEvent extends DomainEvent {
  readonly name = RefreshTokenEventNames.ROTATED;

  constructor(
    aggregateId: string,
    tenantId: Nullable<string>,
    occurredAt: string,
    public readonly familyId: string,
  ) {
    super(aggregateId, tenantId, occurredAt);
  }
}
