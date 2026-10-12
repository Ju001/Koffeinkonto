import { describe, expect, it } from 'vitest';
import { exportAccount, type Account } from './account';
import { STORAGE_KEY, type KV } from './persistence';
import { createStore, LAST_BACKUP_KEY } from './store.svelte';

function memKV(initial?: Record<string, string>): KV & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    async get(k) {
      return data[k] ?? null;
    },
    async set(k, v) {
      data[k] = v;
    },
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

function setup(opts: { primary?: KV; mirror?: KV; stored?: Account; meta?: KV } = {}) {
  const primary = opts.primary ?? memKV(opts.stored ? { [STORAGE_KEY]: exportAccount(opts.stored) } : {});
  const mirror = opts.mirror ?? memKV();
  const meta = opts.meta ?? memKV();
  let n = 0;
  let t = 1000;
  const store = createStore({
    primary,
    mirror,
    meta,
    now: () => (t += 10),
    newId: () => `id${++n}`,
  });
  return { store, primary, mirror, meta };
}

const stored = (updatedAt: number, priceCents = 20): Account => ({
  v: 1,
  priceCents,
  events: [{ id: 'a', ts: 1, type: 'topup', cents: 500 }],
  updatedAt,
});

describe('createStore', () => {
  it('loads the stored account and derives balance', async () => {
    const { store } = setup({ stored: stored(5) });
    expect(store.account).toBeNull();
    await store.init();
    expect(store.status).toBe('ok');
    expect(store.balanceCents).toBe(500);
    expect(store.coffeesLeft).toBe(25);
  });

  it('drink records a coffee and persists to both backends', async () => {
    const { store, primary, mirror } = setup({ stored: stored(5) });
    await store.init();
    await store.drink();
    expect(store.balanceCents).toBe(480);
    expect(store.toast).toEqual({ kind: 'coffee', cents: 20, undoable: true });
    for (const kv of [primary, mirror] as ReturnType<typeof memKV>[]) {
      expect(JSON.parse(kv.data[STORAGE_KEY]).events).toHaveLength(2);
    }
  });

  it('keeps both coffees from two rapid taps', async () => {
    const { store } = setup({ stored: stored(5) });
    await store.init();
    await Promise.all([store.drink(), store.drink()]);
    expect(store.account!.events.filter((e) => e.type === 'coffee')).toHaveLength(2);
    expect(store.balanceCents).toBe(460);
  });

  it('topUp sets an undoable toast', async () => {
    const { store } = setup();
    await store.init();
    await store.topUp(1000);
    expect(store.toast).toEqual({ kind: 'topup', cents: 1000, undoable: true });
    expect(store.balanceCents).toBe(1000);
  });

  it('setPrice adds no event and its toast is not undoable', async () => {
    const { store } = setup({ stored: stored(5) });
    await store.init();
    await store.setPrice(25);
    expect(store.account!.priceCents).toBe(25);
    expect(store.account!.events).toHaveLength(1);
    expect(store.toast).toEqual({ kind: 'price', cents: 25, undoable: false });
  });

  it('undo restores the previous events and clears the toast', async () => {
    const { store } = setup({ stored: stored(5) });
    await store.init();
    await store.drink();
    await store.undo();
    expect(store.balanceCents).toBe(500);
    expect(store.toast).toBeNull();
  });

  it('rolls back and flags saveError when both backends fail', async () => {
    const { store } = setup({ primary: throwingKV, mirror: throwingKV });
    await store.init();
    await store.drink();
    expect(store.account!.events).toHaveLength(0);
    expect(store.saveError).toBe(true);
    expect(store.toast).toBeNull();
  });

  it('clears saveError after a later successful action', async () => {
    let failing = true;
    const flaky: KV = {
      async get() {
        return null;
      },
      async set() {
        if (failing) throw new Error('down');
      },
    };
    const { store } = setup({ primary: flaky, mirror: flaky });
    await store.init();
    await store.topUp(500);
    expect(store.saveError).toBe(true);
    failing = false;
    await store.topUp(500);
    expect(store.saveError).toBe(false);
    expect(store.balanceCents).toBe(500);
  });

  it('applyExternal adopts a newer account and clears the toast', async () => {
    const { store } = setup({ stored: stored(5) });
    await store.init();
    await store.drink();
    const newer = { ...stored(999_999), priceCents: 30 };
    store.applyExternal(exportAccount(newer));
    expect(store.account!.priceCents).toBe(30);
    expect(store.toast).toBeNull();
  });

  it('applyExternal ignores older or invalid data', async () => {
    const { store } = setup({ stored: stored(5) });
    await store.init();
    await store.drink();
    const before = store.account;
    store.applyExternal(exportAccount(stored(1)));
    store.applyExternal('{bad');
    store.applyExternal(null);
    expect(store.account).toEqual(before);
    expect(store.toast).not.toBeNull();
  });

  it('markBackedUp persists the timestamp and init reads it back', async () => {
    const meta = memKV();
    const a = setup({ meta });
    await a.store.init();
    expect(a.store.lastBackupAt).toBeNull();
    await a.store.markBackedUp();
    expect(a.store.lastBackupAt).not.toBeNull();
    expect(meta.data[LAST_BACKUP_KEY]).toBe(String(a.store.lastBackupAt));

    const b = setup({ meta });
    await b.store.init();
    expect(b.store.lastBackupAt).toBe(a.store.lastBackupAt);
  });

  it('is disabled and ignores actions when stored data is corrupt', async () => {
    const { store } = setup({ primary: memKV({ [STORAGE_KEY]: '{bad' }) });
    await store.init();
    expect(store.status).toBe('corrupt');
    expect(store.disabled).toBe(true);
    await store.drink();
    expect(store.account!.events).toHaveLength(0);
  });

  it('importAccount recovers from corrupt state', async () => {
    const { store } = setup({ primary: memKV({ [STORAGE_KEY]: '{bad' }) });
    await store.init();
    expect(await store.importAccount(stored(5))).toBe(true);
    expect(store.status).toBe('ok');
    expect(store.disabled).toBe(false);
    expect(store.balanceCents).toBe(500);
  });

  it('does not wait for a stuck mirror before showing a coffee', async () => {
    const stuck: KV = {
      get: async () => null,
      set: () => new Promise<void>(() => {}),
    };
    const { store } = setup({ stored: stored(5), mirror: stuck });
    await store.init();
    const t0 = performance.now();
    await store.drink();
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(store.balanceCents).toBe(480);
    expect(store.saveError).toBe(false);
  });
});
