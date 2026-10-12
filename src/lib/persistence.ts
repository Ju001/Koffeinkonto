import { emptyAccount, exportAccount, parseAccount, type Account } from './account';

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const STORAGE_KEY = 'koffeinkonto.account';

export type LoadStatus = 'ok' | 'restored' | 'empty' | 'corrupt';

export const BACKEND_TIMEOUT_MS = 2000;

/** Reject if a backend (e.g. a stuck IndexedDB open) does not answer in time. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('storage backend timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function safeGet(kv: KV, ms: number): Promise<string | null> {
  try {
    return await withTimeout(kv.get(STORAGE_KEY), ms);
  } catch {
    return null;
  }
}

async function safeSet(kv: KV, value: string, ms: number): Promise<boolean> {
  try {
    await withTimeout(kv.set(STORAGE_KEY, value), ms);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the account from two independent backends and heal whichever one is
 * missing, stale, or corrupt. Never overwrites data when nothing is valid.
 */
export async function loadAccount(
  primary: KV,
  mirror: KV,
  now: number = Date.now(),
  timeoutMs: number = BACKEND_TIMEOUT_MS,
): Promise<{ account: Account; status: LoadStatus }> {
  const [rawP, rawM] = await Promise.all([
    safeGet(primary, timeoutMs),
    safeGet(mirror, timeoutMs),
  ]);
  const p = parseAccount(rawP);
  const m = parseAccount(rawM);

  if (p && m) {
    if (m.updatedAt > p.updatedAt) {
      await safeSet(primary, exportAccount(m), timeoutMs);
      return { account: m, status: 'restored' };
    }
    if (p.updatedAt > m.updatedAt) await safeSet(mirror, exportAccount(p), timeoutMs);
    return { account: p, status: 'ok' };
  }
  if (p) {
    await safeSet(mirror, exportAccount(p), timeoutMs);
    return { account: p, status: 'ok' };
  }
  if (m) {
    await safeSet(primary, exportAccount(m), timeoutMs);
    return { account: m, status: 'restored' };
  }
  const present = rawP !== null || rawM !== null;
  return { account: emptyAccount(now), status: present ? 'corrupt' : 'empty' };
}

/** Write to both backends. Rejects only if neither accepted the write. */
export async function saveAccount(
  account: Account,
  primary: KV,
  mirror: KV,
  now: number = Date.now(),
  timeoutMs: number = BACKEND_TIMEOUT_MS,
): Promise<Account> {
  // Monotonic: a clock set backwards must never make a newer save look older.
  const stamped: Account = { ...account, updatedAt: Math.max(now, account.updatedAt + 1) };
  const raw = exportAccount(stamped);
  const results = await Promise.all([
    safeSet(primary, raw, timeoutMs),
    safeSet(mirror, raw, timeoutMs),
  ]);
  if (!results.some(Boolean)) {
    throw new Error('No browser storage backend accepted the write');
  }
  return stamped;
}
