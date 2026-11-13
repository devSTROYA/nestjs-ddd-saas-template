import { InvalidInvitationStatusError } from '../../domain/errors/domain.error.js';
import { InvitationStatus } from '../../domain/value-objects/invitation-status.js';
import { toDomain, toMutableColumns, toPersistence } from './invitation.mapper.js';
import type { InvitationRow } from './invitation.schema.js';

const row: InvitationRow = {
  id: '0191a2b3-0000-7000-8000-000000000001',
  email: 'a@b.co',
  invitedBy: '0191a2b3-0000-7000-8000-000000000002',
  otpHash: 'hash',
  expiresAt: new Date('2026-02-01T00:10:00Z'),
  attempts: 2,
  status: InvitationStatus.PENDING,
  createdAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: new Date('2026-02-02T00:00:00Z'),
};

describe('invitation mapper', () => {
  it('maps a row to the domain and back, except the database-managed updatedAt', () => {
    const { updatedAt: _updatedAt, ...stored } = row;

    expect(toPersistence(toDomain(row))).toEqual(stored);
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
    expect(() => toDomain({ ...row, status: 'weird' })).toThrow(InvalidInvitationStatusError);
  });
});
