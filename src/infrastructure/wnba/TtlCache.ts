/** Cache di una risposta che dopo un errore non resta in memoria: il tentativo successivo riparte da zero. */
export class TtlCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T> }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const known = this.entries.get(key);
    if (known && now - known.at < this.ttlMs) return known.value;

    const entry = { at: now, value: load() };
    this.entries.set(key, entry);
    entry.value.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return entry.value;
  }
}
