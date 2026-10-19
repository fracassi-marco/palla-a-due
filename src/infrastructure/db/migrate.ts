import { Database } from './Database';
import { MIGRATIONS } from './schema';

/** Porta il database all'ultima versione dello schema, una migrazione per transazione. */
export async function migrate(db: Database): Promise<void> {
  await db.execAsync('PRAGMA busy_timeout = 10000;');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current + 1; version <= MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(`${MIGRATIONS[version - 1]}\nPRAGMA user_version = ${version};`);
    });
  }
}
