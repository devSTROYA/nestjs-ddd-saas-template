import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';

import { DatabaseContext } from '@common/database';
import type { Nullable } from '@common/types';
import { AdminId } from '@modules/admins';

import { RefreshToken } from '../../domain/entities/refresh-token.js';
import { RefreshTokenEventNames } from '../../domain/events/refresh-token.events.js';
import { TokenFamilyId } from '../../domain/value-objects/ids.js';
import { PrincipalType } from '../../domain/value-objects/principal.js';
import { DrizzleRefreshTokenRepository } from './drizzle-refresh-token.repository.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const IN_A_DAY = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
const PRINCIPAL = { type: PrincipalType.ADMIN, id: AdminId.create().value };

const pool = new Pool({ connectionString: inject('databaseUrl') });
const context = new DatabaseContext(drizzle(pool));
const repository = new DrizzleRefreshTokenRepository(context);

const issue = (tokenHash: string, familyId: TokenFamilyId = TokenFamilyId.create()) =>
  RefreshToken.issue({
    familyId,
    principal: PRINCIPAL,
    tokenHash,
    expiresAt: IN_A_DAY,
    createdAt: NOW,
  });

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE refresh_tokens, outbox');
});

afterAll(async () => {
  await pool.end();
});

describe('DrizzleRefreshTokenRepository', () => {
  it('saves a token and finds it by its hash', async () => {
    const token = issue('a'.repeat(64));
    await repository.save(token);

    const found = await context.run(() => repository.findByHashForUpdate('a'.repeat(64)));

    expect(found?.id).toEqual(token.id);
    expect(found?.familyId).toEqual(token.familyId);
    expect(found?.principal).toEqual(PRINCIPAL);
    expect(found?.expiresAt).toEqual(IN_A_DAY);
    expect(found?.usedAt).toBeNull();
    expect(found?.revokedAt).toBeNull();
  });

  it('returns null for an unknown hash', async () => {
    expect(await repository.findByHashForUpdate('f'.repeat(64))).toBeNull();
  });

  it('persists the used timestamp after a rotation', async () => {
    const token = issue('a'.repeat(64));
    await repository.save(token);

    token.rotate(NOW);
    await repository.save(token);

    const found = await repository.findByHashForUpdate('a'.repeat(64));
    expect(found?.usedAt).toEqual(NOW);
  });

  it('rejects two tokens with the same hash', async () => {
    await repository.save(issue('a'.repeat(64)));

    await expect(repository.save(issue('a'.repeat(64)))).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });

  it('writes the raised events to the outbox with the token', async () => {
    const token = issue('a'.repeat(64));
    await repository.save(token);

    const { rows } = await pool.query(
      'SELECT name, aggregate_id, payload FROM outbox ORDER BY name',
    );
    expect(rows).toEqual([
      {
        name: RefreshTokenEventNames.ISSUED,
        aggregate_id: token.id.value,
        payload: { familyId: token.familyId.value, principalType: PrincipalType.ADMIN },
      },
    ]);
  });

  it('leaves neither the token nor its events when the surrounding transaction fails', async () => {
    await expect(
      context.run(async () => {
        await repository.save(issue('a'.repeat(64)));
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    const tokens = await pool.query('SELECT 1 FROM refresh_tokens');
    const events = await pool.query('SELECT 1 FROM outbox');
    expect(tokens.rowCount).toBe(0);
    expect(events.rowCount).toBe(0);
  });

  it('revokes every unrevoked token of one family and leaves other families alone', async () => {
    const family = TokenFamilyId.create();
    await repository.save(issue('a'.repeat(64), family));
    await repository.save(issue('b'.repeat(64), family));
    await repository.save(issue('c'.repeat(64)));

    await repository.revokeFamily(family, NOW);

    const { rows } = await pool.query<{ token_hash: string; revoked_at: Nullable<Date> }>(
      'SELECT token_hash, revoked_at FROM refresh_tokens ORDER BY token_hash',
    );
    expect(rows.map((row) => row.revoked_at !== null)).toEqual([true, true, false]);
  });

  it('queues one family_revoked event only when revoking changed something', async () => {
    const family = TokenFamilyId.create();
    await repository.save(issue('a'.repeat(64), family));
    await pool.query('TRUNCATE TABLE outbox');

    await repository.revokeFamily(family, NOW);
    await repository.revokeFamily(family, NOW);

    const { rows } = await pool.query<{ name: string; aggregate_id: string; payload: unknown }>(
      'SELECT name, aggregate_id, payload FROM outbox',
    );
    expect(rows).toEqual([
      {
        name: RefreshTokenEventNames.FAMILY_REVOKED,
        aggregate_id: family.value,
        payload: { revokedTokens: 1 },
      },
    ]);
  });
});
