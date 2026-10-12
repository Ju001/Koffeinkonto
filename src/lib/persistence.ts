import { emptyAccount, exportAccount, parseAccount, type Account } from './account';

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const STORAGE_KEY = 'koffeinkonto.account';

export type LoadStatus = 'ok' | 'restored' | 'empty' | 'corrupt';

async function safeGet(kv: KV): Promise<string | null> {
  try {
    return await kv.get(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function safeSet(kv: KV, value: string): Promise<boolean> {
  try {
    await kv.set(STORAGE_KEY, value);
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
): Promise<{ account: Account; status: LoadStatus }> {
  const [rawP, rawM] = await Promise.all([safeGet(primary), safeGet(mirror)]);
  const p = parseAccount(rawP);
  const m = parseAccount(rawM);

  if (p && m) {
    if (m.updatedAt > p.updatedAt) {
      await safeSet(primary, exportAccount(m));
      return { account: m, status: 'restored' };
    }
    if (p.updatedAt > m.updatedAt) await safeSet(mirror, exportAccount(p));
    return { account: p, status: 'ok' };
  }
  if (p) {
    await safeSet(mirror, exportAccount(p));
    return { account: p, status: 'ok' };
  }
  if (m) {
    await safeSet(primary, exportAccount(m));
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
): Promise<Account> {
  const stamped: Account = { ...account, updatedAt: now };
  const raw = exportAccount(stamped);
  const results = await Promise.all([safeSet(primary, raw), safeSet(mirror, raw)]);
  if (!results.some(Boolean)) {
    throw new Error('No browser storage backend accepted the write');
  }
  return stamped;
}
