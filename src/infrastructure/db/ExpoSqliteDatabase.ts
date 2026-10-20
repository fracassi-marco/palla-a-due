import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';

import { Database, SqlExecutor, SqlValue } from './Database';
import { migrate } from './migrate';

class Executor implements SqlExecutor {
  constructor(private readonly raw: SQLiteDatabase) {}

  execAsync(sql: string) {
    return this.raw.execAsync(sql);
  }

  async runAsync(sql: string, params: SqlValue[] = []) {
    await this.raw.runAsync(sql, params);
  }

  getAllAsync<T>(sql: string, params: SqlValue[] = []) {
    return this.raw.getAllAsync<T>(sql, params);
  }

  getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
    return this.raw.getFirstAsync<T>(sql, params);
  }
}

class DirectDatabase extends Executor implements Database {
  constructor(private readonly db: SQLiteDatabase) {
    super(db);
  }

  withExclusiveTransactionAsync(task: (txn: SqlExecutor) => Promise<void>) {
    return this.db.withExclusiveTransactionAsync((txn) => task(new Executor(txn)));
  }
}

/** Database SQLite su disco: ogni operazione attende che lo schema sia aggiornato. */
export class ExpoSqliteDatabase implements Database {
  private readonly direct: DirectDatabase;
  private readonly ready: Promise<void>;
  /** SQLite ammette un solo scrittore: le scritture (anche le transazioni, su connessioni separate) vanno in fila. */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(name: string) {
    this.direct = new DirectDatabase(openDatabaseSync(name));
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
    return this.write(() =>
      this.direct.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync('PRAGMA busy_timeout = 10000;');
        await task(txn);
      }),
    );
  }
}
