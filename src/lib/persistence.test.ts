import { describe, expect, it } from 'vitest';
import { emptyAccount, exportAccount, type Account } from './account';
import { loadAccount, saveAccount, STORAGE_KEY, type KV } from './persistence';

function memKV(initial?: string): KV & { raw(): string | null } {
  let value: string | null = initial ?? null;
  return {
    async get() {
      return value;
    },
    async set(_k, v) {
      value = v;
    },
    raw: () => value,
  };
}

const throwingKV: KV = {
  async get() {
    throw new Error('unavailable');
  },
  async set() {
    throw new Error('unavailable');
  },
};

// Key order matches parseAccount's canonical output, so raw strings compare equal.
const acct = (updatedAt: number, priceCents = 20): Account => ({
  v: 1,
  priceCents,
  events: [{ id: 'a', ts: 1, type: 'topup', cents: 500 }],
  updatedAt,
});

describe('loadAccount', () => {
  it('returns an empty account and writes nothing on first run', async () => {
    const p = memKV();
    const m = memKV();
    const r = await loadAccount(p, m, 7);
    expect(r.status).toBe('empty');
    expect(r.account).toEqual(emptyAccount(7));
    expect(p.raw()).toBeNull();
    expect(m.raw()).toBeNull();
  });

  it('round-trips a saved account', async () => {
    const p = memKV();
    const m = memKV();
    const saved = await saveAccount(acct(1), p, m, 100);
    expect(saved.updatedAt).toBe(100);
    const r = await loadAccount(p, m);
    expect(r.status).toBe('ok');
    expect(r.account).toEqual(saved);
    expect(p.raw()).toBe(m.raw());
  });

  it('restores primary from the mirror when primary was wiped', async () => {
    const m = memKV(exportAccount(acct(5)));
    const p = memKV();
    const r = await loadAccount(p, m);
    expect(r.status).toBe('restored');
    expect(r.account).toEqual(acct(5));
    expect(p.raw()).not.toBeNull();
  });

  it('restores primary when it holds corrupt data', async () => {
    const p = memKV('{garbage');
    const m = memKV(exportAccount(acct(5)));
    const r = await loadAccount(p, m);
    expect(r.status).toBe('restored');
    expect(r.account).toEqual(acct(5));
    expect(p.raw()).toBe(m.raw());
  });

  it('heals a wiped mirror from primary', async () => {
    const p = memKV(exportAccount(acct(5)));
    const m = memKV();
    const r = await loadAccount(p, m);
    expect(r.status).toBe('ok');
    expect(m.raw()).toBe(p.raw());
  });

  it('prefers the newer copy and updates the stale one', async () => {
    const p = memKV(exportAccount(acct(1, 20)));
    const m = memKV(exportAccount(acct(9, 30)));
    const r = await loadAccount(p, m);
    expect(r.account.priceCents).toBe(30);
    expect(r.status).toBe('restored');
    expect(p.raw()).toBe(m.raw());
  });

  it('reports corrupt and does not overwrite when nothing is valid', async () => {
    const p = memKV('{bad');
    const m = memKV('also bad');
    const r = await loadAccount(p, m, 3);
    expect(r.status).toBe('corrupt');
    expect(r.account).toEqual(emptyAccount(3));
    expect(p.raw()).toBe('{bad');
    expect(m.raw()).toBe('also bad');
  });

  it('still loads when one backend throws', async () => {
    const m = memKV(exportAccount(acct(5)));
    const r = await loadAccount(throwingKV, m);
    expect(r.account).toEqual(acct(5));
    expect(r.status).toBe('restored');
  });

  it('uses the documented storage key', () => {
    expect(STORAGE_KEY).toBe('koffeinkonto.account');
  });
});

describe('saveAccount', () => {
  it('succeeds when only one backend accepts the write', async () => {
    const m = memKV();
    await expect(saveAccount(acct(1), throwingKV, m)).resolves.toBeDefined();
    expect(m.raw()).not.toBeNull();
  });

  it('rejects when both backends fail', async () => {
    await expect(saveAccount(acct(1), throwingKV, throwingKV)).rejects.toThrow();
  });
});
