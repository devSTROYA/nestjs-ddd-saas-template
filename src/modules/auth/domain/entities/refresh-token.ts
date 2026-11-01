import { AggregateRoot } from '@common/ddd';
import type { Nullable } from '@common/types';

import {
  RefreshTokenIssuedEvent,
  RefreshTokenRotatedEvent,
} from '../events/refresh-token.events.js';
import type { RefreshTokenId, TokenFamilyId } from '../value-objects/ids.js';
import type { Principal } from '../value-objects/principal.js';

export const RotationOutcome = {
  ROTATED: 'rotated',
  REUSED: 'reused',
  EXPIRED: 'expired',
} as const;

export type RotationOutcome = (typeof RotationOutcome)[keyof typeof RotationOutcome];

type Props = {
  familyId: TokenFamilyId;
  principal: Principal;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Nullable<Date>;
  revokedAt: Nullable<Date>;
  createdAt: Date;
};

type CreateProps = {
  familyId: TokenFamilyId;
  principal: Principal;
  tokenHash: string;
  expiresAt: Date;
};

export class RefreshToken extends AggregateRoot<Props, RefreshTokenId> {
  static issue(props: CreateProps, id: RefreshTokenId, now: Date): RefreshToken {
    const token = new RefreshToken(
      {
        familyId: props.familyId,
        principal: props.principal,
        tokenHash: props.tokenHash,
        expiresAt: props.expiresAt,
        usedAt: null,
        revokedAt: null,
        createdAt: now,
      },
      id,
    );
    token.addEvent(
      new RefreshTokenIssuedEvent(
        id,
        props.principal.tenantId ?? null,
        now.toISOString(),
        props.familyId,
        props.principal.type,
      ),
    );
    return token;
  }

  static restore(props: Props, id: RefreshTokenId): RefreshToken {
    return new RefreshToken(props, id);
  }

  get familyId(): TokenFamilyId {
    return this.props.familyId;
  }

  get principal(): Principal {
    return this.props.principal;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get usedAt(): Nullable<Date> {
    return this.props.usedAt;
  }

  get revokedAt(): Nullable<Date> {
    return this.props.revokedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  rotate(now: Date): RotationOutcome {
    if (this.props.usedAt !== null || this.props.revokedAt !== null) {
      return RotationOutcome.REUSED;
    }
    if (now >= this.props.expiresAt) {
      return RotationOutcome.EXPIRED;
    }
    this.props.usedAt = now;
    this.addEvent(
      new RefreshTokenRotatedEvent(
        this.id,
        this.props.principal.tenantId ?? null,
        now.toISOString(),
        this.props.familyId,
      ),
    );
    return RotationOutcome.ROTATED;
  }
}
