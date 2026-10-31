import { newAdminId } from '@modules/admins';

import { RefreshTokenEventNames } from '../events/refresh-token.events.js';
import { newRefreshTokenId, newTokenFamilyId } from '../value-objects/ids.js';
import { PrincipalType } from '../value-objects/principal.js';
import { RefreshToken, RotationOutcome } from './refresh-token.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const IN_A_DAY = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);

const issue = (): RefreshToken =>
  RefreshToken.issue(
    {
      id: newRefreshTokenId(),
      familyId: newTokenFamilyId(),
      principal: { type: PrincipalType.ADMIN, id: newAdminId() },
      tokenHash: 'hash',
      expiresAt: IN_A_DAY,
    },
    NOW,
  );

describe('RefreshToken', () => {
  it('rotates once and marks itself used', () => {
    const token = issue();

    expect(token.rotate(NOW)).toBe(RotationOutcome.ROTATED);
    expect(token.usedAt).toBe(NOW);
  });

  it('reports reuse when it is rotated a second time', () => {
    const token = issue();
    token.rotate(NOW);

    expect(token.rotate(NOW)).toBe(RotationOutcome.REUSED);
  });

  it('reports reuse for a revoked token', () => {
    const token = RefreshToken.restore({
      ...issueProps(),
      usedAt: null,
      revokedAt: NOW,
    });

    expect(token.rotate(NOW)).toBe(RotationOutcome.REUSED);
  });

  it('reports expiry without marking itself used', () => {
    const token = issue();

    expect(token.rotate(IN_A_DAY)).toBe(RotationOutcome.EXPIRED);
    expect(token.usedAt).toBeNull();
  });

  it('raises issued on issue, once, without the token hash', () => {
    const token = issue();

    const events = token.pullEvents();
    expect(events).toMatchObject([
      {
        name: RefreshTokenEventNames.ISSUED,
        aggregateId: token.id,
        tenantId: null,
        occurredAt: NOW.toISOString(),
        familyId: token.familyId,
        principalType: PrincipalType.ADMIN,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('"hash"');
    expect(token.pullEvents()).toEqual([]);
  });

  it('raises rotated only when the rotation succeeds', () => {
    const token = issue();
    token.pullEvents();

    token.rotate(NOW);
    token.rotate(NOW);

    expect(token.pullEvents()).toMatchObject([
      { name: RefreshTokenEventNames.ROTATED, aggregateId: token.id, familyId: token.familyId },
    ]);
  });

  it('raises nothing for an expired rotation', () => {
    const token = issue();
    token.pullEvents();

    token.rotate(IN_A_DAY);

    expect(token.pullEvents()).toEqual([]);
  });

  it('raises no event on restore', () => {
    const token = RefreshToken.restore({ ...issueProps(), usedAt: null, revokedAt: null });

    expect(token.pullEvents()).toEqual([]);
  });
});

function issueProps() {
  return {
    id: newRefreshTokenId(),
    familyId: newTokenFamilyId(),
    principal: { type: PrincipalType.ADMIN, id: newAdminId() },
    tokenHash: 'hash',
    expiresAt: IN_A_DAY,
    createdAt: NOW,
  };
}
