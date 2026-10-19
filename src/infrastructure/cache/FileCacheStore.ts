import { Directory, File, Paths } from 'expo-file-system';

import { CacheEntry, CacheStore } from './CacheStore';

interface StoredFile extends CacheEntry {
  key: string;
}

/** Cache persistente su disco: un file JSON per chiave, sopravvive al riavvio dell'app. */
export class FileCacheStore implements CacheStore {
  private readonly dir: Directory;
  private ready = false;

  constructor(directoryName = 'http-cache') {
    this.dir = new Directory(Paths.cache, directoryName);
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const file = this.fileFor(key);
      if (!file.exists) return null;
      const stored = JSON.parse(await file.text()) as StoredFile;
      // Il nome file è un hash: la chiave salvata esclude le collisioni.
      if (stored.key !== key) return null;
      return { data: stored.data, expiresAt: stored.expiresAt };
    } catch {
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      this.ensureDir();
      const file = this.fileFor(key);
      file.create({ overwrite: true });
      await file.write(JSON.stringify({ key, ...entry } satisfies StoredFile));
    } catch {
      // La cache è best effort: un errore di scrittura non deve far fallire la richiesta.
    }
  }

  private ensureDir() {
    if (this.ready) return;
    this.dir.create({ idempotent: true, intermediates: true });
    this.ready = true;
  }

  private fileFor(key: string): File {
    return new File(this.dir, `${hash(key)}.json`);
  }
}

/** FNV-1a a 32 bit: sufficiente per nomi file brevi e sicuri. */
function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
