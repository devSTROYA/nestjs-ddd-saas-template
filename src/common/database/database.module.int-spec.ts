import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { type MockInstance, inject } from 'vitest';

import { DATABASE_CONTEXT, type DatabaseContext } from './database-context.js';
import { DatabaseModule } from './database.module.js';

const APPLICATION_NAME = 'database-module-int-spec';

const adminPool = new Pool({ connectionString: inject('databaseUrl') });

function moduleDatabaseUrl(): string {
  const url = new URL(inject('databaseUrl'));
  url.searchParams.set('application_name', APPLICATION_NAME);
  return url.toString();
}

async function terminateModuleConnections(): Promise<number> {
  const { rowCount } = await adminPool.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = $1',
    [APPLICATION_NAME],
  );
  return rowCount ?? 0;
}

describe('DatabaseModule (integration)', () => {
  let moduleRef: TestingModule;
  let context: DatabaseContext;
  let loggedError: MockInstance<Logger['error']>;

  const expectQueriesWork = (): Promise<void> =>
    vi.waitFor(async () => {
      await context.client.execute(sql`select 1`);
    });

  beforeEach(async () => {
    loggedError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.stubEnv('DATABASE_URL', moduleDatabaseUrl());
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), DatabaseModule],
    }).compile();
    context = moduleRef.get(DATABASE_CONTEXT);
  });

  afterEach(async () => {
    await moduleRef.close();
    vi.unstubAllEnvs();
    loggedError.mockRestore();
  });

  afterAll(async () => {
    await adminPool.end();
  });

  it('survives losing an idle connection', async () => {
    await context.client.execute(sql`select 1`);

    expect(await terminateModuleConnections()).toBe(1);

    // INFO: Wait for the loss to arrive while the client is idle; a query sent earlier would take the
    // client and hide the event from the pool.
    await vi.waitFor(() => {
      expect(loggedError).toHaveBeenCalledWith(expect.stringContaining('connection lost'));
    });
    await expectQueriesWork();
  });

  it('survives losing the connection of an open transaction', async () => {
    await expect(
      context.run(async () => {
        await context.client.execute(sql`select 1`);
        await terminateModuleConnections();
        await context.client.execute(sql`select pg_sleep(1)`);
      }),
    ).rejects.toThrow();

    await expectQueriesWork();
  });

  it('makes Postgres cancel statements that run too long', async () => {
    const { rows } = await context.client.execute(sql`show statement_timeout`);

    expect(rows).toEqual([{ statement_timeout: '10s' }]);
  });
});
