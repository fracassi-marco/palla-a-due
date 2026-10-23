import SqliteDriver from 'better-sqlite3';

import { Database, SqlExecutor, SqlValue } from '../../src/infrastructure/db/Database';
import { migrate } from '../../src/infrastructure/db/migrate';

class Executor implements SqlExecutor {
  constructor(protected readonly raw: SqliteDriver.Database) {}

  async execAsync(sql: string) {
    this.raw.exec(sql);
  }

  async runAsync(sql: string, params: SqlValue[] = []) {
    this.raw.prepare(sql).run(...params);
  }

  async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
    return (this.raw.prepare(sql).get(...params) as T | undefined) ?? null;
  }
}

class DirectDatabase extends Executor implements Database {
  async withExclusiveTransactionAsync(task: (txn: SqlExecutor) => Promise<void>) {
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      await task(new Executor(this.raw));
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }
}

/**
 * Database SQLite su disco per il server (stesso schema e stesse migrazioni della app).
 * Una sola connessione: le scritture, transazioni comprese, vanno in fila, altrimenti un'istruzione
 * di un altro task finirebbe dentro la transazione aperta (le richieste di rete sono concorrenti).
 */
export class BetterSqliteDatabase implements Database {
  private readonly raw: SqliteDriver.Database;
  private readonly direct: DirectDatabase;
  private readonly ready: Promise<void>;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.raw = new SqliteDriver(path);
    this.direct = new DirectDatabase(this.raw);
    this.ready = migrate(this.direct);
  }

  private write<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  async execAsync(sql: string) {
    await this.ready;
    return this.write(() => this.direct.execAsync(sql));
  }

  async runAsync(sql: string, params?: SqlValue[]) {
    await this.ready;
    return this.write(() => this.direct.runAsync(sql, params));
  }

  async getAllAsync<T>(sql: string, params?: SqlValue[]) {
    await this.ready;
    return this.direct.getAllAsync<T>(sql, params);
  }

  async getFirstAsync<T>(sql: string, params?: SqlValue[]) {
    await this.ready;
    return this.direct.getFirstAsync<T>(sql, params);
  }

  async withExclusiveTransactionAsync(task: (txn: SqlExecutor) => Promise<void>) {
    await this.ready;
    return this.write(() => this.direct.withExclusiveTransactionAsync(task));
  }

  /** Attende le scritture in corso e chiude il file (il checkpoint del WAL lo fa SQLite alla chiusura). */
  async close() {
    await this.writeQueue;
    this.raw.close();
  }
}
