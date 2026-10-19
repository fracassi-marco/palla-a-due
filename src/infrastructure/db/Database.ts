export type SqlValue = string | number | null;

/** Il sottoinsieme di expo-sqlite che usiamo: lo stesso contratto vale per il database e per le sue transazioni. */
export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlValue[]): Promise<void>;
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}

export interface Database extends SqlExecutor {
  /** Le scritture della transazione sono atomiche e non si intrecciano con altre scritture. */
  withExclusiveTransactionAsync(task: (txn: SqlExecutor) => Promise<void>): Promise<void>;
}
