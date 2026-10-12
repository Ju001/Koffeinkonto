import type { KV } from './persistence';

export const localStorageKV: KV = {
  async get(key) {
    return localStorage.getItem(key);
  },
  async set(key, value) {
    localStorage.setItem(key, value);
  },
};

const DB_NAME = 'koffeinkonto';
const STORE = 'kv';
let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      // Drop the cached connection whenever it goes away so the next call reopens it.
      db.onclose = () => forget(attempt);
      db.onversionchange = () => {
        db.close();
        forget(attempt);
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  // Never cache a failed open; the next call retries.
  attempt.catch(() => forget(attempt));
  dbPromise = attempt;
  return attempt;
}

function forget(p: Promise<IDBDatabase>) {
  if (dbPromise === p) dbPromise = undefined;
}

function transact<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const pending = openDb();
  const db = await pending;
  try {
    return await transact(db, mode, fn);
  } catch (err) {
    // A connection closed behind our back throws InvalidStateError: reopen once.
    if (!(err instanceof DOMException && err.name === 'InvalidStateError')) throw err;
    forget(pending);
    return transact(await openDb(), mode, fn);
  }
}

export const indexedDbKV: KV = {
  async get(key) {
    const v = await run('readonly', (s) => s.get(key));
    return typeof v === 'string' ? v : null;
  },
  async set(key, value) {
    await run('readwrite', (s) => s.put(value, key));
  },
};

/**
 * Ask the browser not to evict our storage. Browsers may refuse (e.g. when the
 * site is not installed or has low engagement); callers should surface that.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
