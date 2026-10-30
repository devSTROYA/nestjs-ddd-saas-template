import { Pool } from 'pg';
import { inject } from 'vitest';

const CONSTRAINT_PREFIX: Readonly<Record<string, RegExp>> = {
  p: /^pk_[a-z0-9_]+$/,
  f: /^fk_[a-z0-9_]+$/,
  u: /^uq_[a-z0-9_]+$/,
  c: /^ck_[a-z0-9_]+$/,
};
const INDEX_NAME = /^(uq|idx)_[a-z0-9_]+$/;
const MAX_IDENTIFIER_LENGTH = 63;

const pool = new Pool({ connectionString: inject('databaseUrl') });

const names = async (sql: string): Promise<{ name: string; type?: string }[]> => {
  const { rows } = await pool.query<{ name: string; type?: string }>(sql);
  return rows;
};

afterAll(async () => {
  await pool.end();
});

describe('database naming convention', () => {
  it('prefixes every constraint with its kind: pk_, fk_, uq_ or ck_', async () => {
    const constraints = await names(`
      SELECT c.conname AS name, c.contype AS type
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.contype IN ('p', 'f', 'u', 'c')`);

    expect(constraints.length).toBeGreaterThan(0);
    const violations = constraints.filter(
      ({ name, type }) => !CONSTRAINT_PREFIX[type ?? '']?.test(name),
    );
    expect(violations).toEqual([]);
  });

  it('prefixes every index with uq_ or idx_ (primary keys carry their pk_ constraint name)', async () => {
    const indexes = await names(`
      SELECT i.indexname AS name
      FROM pg_indexes i
      WHERE i.schemaname = 'public'
        AND i.indexname NOT IN (
          SELECT c.conname FROM pg_constraint c WHERE c.contype = 'p')`);

    const violations = indexes.filter(({ name }) => !INDEX_NAME.test(name));
    expect(indexes.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it('keeps every name within the Postgres identifier limit', async () => {
    const identifiers = await names(`
      SELECT conname AS name FROM pg_constraint
      UNION ALL SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public'`);

    expect(identifiers.filter(({ name }) => name.length > MAX_IDENTIFIER_LENGTH)).toEqual([]);
  });

  it('indexes the first column of every foreign key', async () => {
    const unindexed = await names(`
      SELECT c.conname AS name
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.contype = 'f'
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])`);

    expect(unindexed).toEqual([]);
  });
});
