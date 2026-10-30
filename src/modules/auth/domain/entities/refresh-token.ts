import type { RefreshTokenId, TokenFamilyId } from '../value-objects/ids.js';
import type { Principal } from '../value-objects/principal.js';

export const RotationOutcome = {
  ROTATED: 'rotated',
  REUSED: 'reused',
  EXPIRED: 'expired',
} as const;

export type RotationOutcome = (typeof RotationOutcome)[keyof typeof RotationOutcome];

export class RefreshToken {
  private constructor(
    public readonly id: RefreshTokenId,
    public readonly familyId: TokenFamilyId,
    public readonly principal: Principal,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    private _usedAt: Date | null,
    private _revokedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  static issue(
    props: {
      id: RefreshTokenId;
      familyId: TokenFamilyId;
      principal: Principal;
      tokenHash: string;
      expiresAt: Date;
    },
    now: Date,
  ): RefreshToken {
    return new RefreshToken(
      props.id,
      props.familyId,
      props.principal,
      props.tokenHash,
      props.expiresAt,
      null,
      null,
      now,
    );
  }

  static restore(props: {
    id: RefreshTokenId;
    familyId: TokenFamilyId;
    principal: Principal;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): RefreshToken {
    return new RefreshToken(
      props.id,
      props.familyId,
      props.principal,
      props.tokenHash,
      props.expiresAt,
      props.usedAt,
      props.revokedAt,
      props.createdAt,
    );
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  rotate(now: Date): RotationOutcome {
    if (this._usedAt !== null || this._revokedAt !== null) {
      return RotationOutcome.REUSED;
    }
    if (now >= this.expiresAt) {
      return RotationOutcome.EXPIRED;
    }
    this._usedAt = now;
    return RotationOutcome.ROTATED;
  }
}
