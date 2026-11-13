import { InvalidPrincipalTypeError } from '../../domain/errors/domain.error.js';
import { PrincipalType } from '../../domain/value-objects/principal.js';
import { toDomain, toPersistence } from './refresh-token.mapper.js';
import type { RefreshTokenRow } from './refresh-token.schema.js';

const row: RefreshTokenRow = {
  id: '0191a2b3-0000-7000-8000-000000000001',
  familyId: '0191a2b3-0000-7000-8000-000000000002',
  principalType: PrincipalType.USER,
  principalId: '0191a2b3-0000-7000-8000-000000000003',
  tenantId: '0191a2b3-0000-7000-8000-000000000004',
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date('2026-03-01T00:00:00Z'),
  usedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-02-01T00:00:00Z'),
};

describe('refresh token mapper', () => {
  it('maps a row to the domain and back unchanged', () => {
    expect(toPersistence(toDomain(row))).toEqual(row);
  });

  it('keeps no tenant for an admin token', () => {
    const adminRow = { ...row, principalType: PrincipalType.ADMIN, tenantId: null };

    expect(toDomain(adminRow).principal).toEqual({ type: 'admin', id: row.principalId });
    expect(toPersistence(toDomain(adminRow)).tenantId).toBeNull();
  });

  it('rejects an unknown principal type', () => {
    expect(() => toDomain({ ...row, principalType: 'robot' })).toThrow(InvalidPrincipalTypeError);
  });
});
