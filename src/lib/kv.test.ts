import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KV } from './persistence';

let kv: KV;
let opened: IDBDatabase[];

beforeEach(async () => {
  // Fresh database and fresh module state (the connection cache) per test.
  const factory = new IDBFactory();
  opened = [];
  const open = factory.open.bind(factory);
  factory.open = (...args: Parameters<IDBFactory['open']>) => {
    const req = open(...args);
    req.addEventListener('success', () => opened.push(req.result));
    return req;
  };
  globalThis.indexedDB = factory;
  vi.resetModules();
  kv = (await import('./kv')).indexedDbKV;
});

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('koffeinkonto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

describe('indexedDbKV', () => {
  it('round-trips a value', async () => {
    await kv.set('k', 'v');
    expect(await kv.get('k')).toBe('v');
  });

  it('reopens after its connection was closed', async () => {
    await kv.set('k', 'v');
    opened[0].close();
    await kv.set('k', 'w');
    expect(await kv.get('k')).toBe('w');
  });

  it('releases the database when another context deletes it, then reopens', async () => {
    await kv.set('k', 'v');
    await deleteDb();
    expect(await kv.get('k')).toBeNull();
    await kv.set('k', 'x');
    expect(await kv.get('k')).toBe('x');
  });

  it('retries the open after a failed attempt', async () => {
    const real = indexedDB.open;
    indexedDB.open = () => {
      throw new Error('open failed');
    };
    await expect(kv.get('k')).rejects.toThrow();
    indexedDB.open = real;
    await kv.set('k', 'v');
    expect(await kv.get('k')).toBe('v');
  });
});
