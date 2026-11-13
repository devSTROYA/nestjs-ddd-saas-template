import { InvalidLoginChallengeStatusError } from '../../domain/errors/domain.error.js';
import { LoginChallengeStatus } from '../../domain/value-objects/login-challenge-status.js';
import { toDomain, toMutableColumns, toPersistence } from './login-challenge.mapper.js';
import type { LoginChallengeRow } from './login-challenge.schema.js';

const UPDATED_AT = new Date('2026-02-02T00:00:00Z');

const row: LoginChallengeRow = {
  id: '0191a2b3-0000-7000-8000-000000000001',
  tenantId: '0191a2b3-0000-7000-8000-000000000002',
  email: 'a@b.co',
  otpHash: 'hash',
  expiresAt: new Date('2026-02-01T00:10:00Z'),
  attempts: 1,
  status: LoginChallengeStatus.PENDING,
  createdAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: UPDATED_AT,
};

describe('login challenge mapper', () => {
  it('maps a row to the domain and back, except the database-managed updatedAt', () => {
    const { updatedAt: _updatedAt, ...stored } = row;

    expect(toPersistence(toDomain(row))).toEqual(stored);
  });

  it('keeps no tenant for an admin challenge', () => {
    expect(toPersistence(toDomain({ ...row, tenantId: null })).tenantId).toBeNull();
  });

  it('only exposes the columns a resend may change', () => {
    expect(Object.keys(toMutableColumns(toDomain(row))).sort()).toEqual([
      'attempts',
      'expiresAt',
      'otpHash',
      'status',
    ]);
  });

  it('rejects an unknown status', () => {
    expect(() => toDomain({ ...row, status: 'weird' })).toThrow(InvalidLoginChallengeStatusError);
  });
});
