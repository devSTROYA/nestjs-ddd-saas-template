import { AsyncLocalStorage } from 'node:async_hooks';

import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';

export type Database = NodePgDatabase;
type DatabaseClient = PgDatabase<NodePgQueryResultHKT>;

export const DATABASE = Symbol('DATABASE');
export const DATABASE_CONTEXT = Symbol('DATABASE_CONTEXT');

export class DatabaseContext {
  private readonly storage = new AsyncLocalStorage<DatabaseClient>();

  constructor(private readonly database: Database) {}

  get client(): DatabaseClient {
    return this.storage.getStore() ?? this.database;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) {
      return work();
    }
    return this.database.transaction((transaction) => this.storage.run(transaction, work));
  }
}
