import { parseAccount, type Account } from './account';
import { balanceCents, coffeesLeft, drink, setPrice, topUp, undo } from './ops';
import { loadAccount, saveAccount, type KV, type LoadStatus } from './persistence';

export const LAST_BACKUP_KEY = 'koffeinkonto.lastBackup';

/**
 * Per-backend write timeout for actions. Short on purpose: a stuck IndexedDB
 * (e.g. after iOS backgrounding) must not delay the count by seconds per tap.
 * The abandoned write still completes in the background and load heals drift.
 */
export const SAVE_TIMEOUT_MS = 250;

export interface StoreDeps {
  primary: KV;
  mirror: KV;
  /** Holds the last-backup timestamp; kept outside the Account schema. */
  meta: KV;
  now?: () => number;
  newId?: () => string;
}

export type Toast = {
  kind: 'coffee' | 'topup' | 'price';
  cents: number;
  undoable: boolean;
  /** The event this toast describes; Undo removes only that event. */
  eventId?: string;
};

export interface Store {
  readonly account: Account | null;
  readonly status: LoadStatus | null;
  readonly saveError: boolean;
  readonly toast: Toast | null;
  readonly lastBackupAt: number | null;
  readonly balanceCents: number;
  readonly coffeesLeft: number;
  /** True while loading or when stored data is corrupt; actions are ignored. */
  readonly disabled: boolean;
  init(): Promise<void>;
  drink(): Promise<void>;
  topUp(cents: number): Promise<void>;
  setPrice(cents: number): Promise<void>;
  /** Remove the named event if it is still the last one; otherwise do nothing. */
  undo(eventId: string): Promise<void>;
  dismissToast(): void;
  markBackedUp(): Promise<void>;
  /** Adopt another tab's write (from a `storage` event). */
  applyExternal(raw: string | null): void;
  /** Adopt another tab's last-backup timestamp. */
  applyExternalBackup(raw: string | null): void;
  importAccount(a: Account): Promise<boolean>;
}

function parseBackupTs(raw: string | null): number | null {
  const ts = Number(raw);
  return raw && Number.isFinite(ts) && ts > 0 ? ts : null;
}

let idCounter = 0;
const fallbackId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export function createStore(deps: StoreDeps): Store {
  const { primary, mirror, meta } = deps;
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? fallbackId;

  let account = $state.raw<Account | null>(null);
  let status = $state<LoadStatus | null>(null);
  let saveError = $state(false);
  let toast = $state<Toast | null>(null);
  let lastBackupAt = $state<number | null>(null);

  // Actions run one at a time so rapid taps cannot interleave saves.
  let chain: Promise<void> = Promise.resolve();
  const enqueue = (fn: () => Promise<void>): Promise<void> => {
    const run = chain.then(fn);
    chain = run.catch(() => {});
    return run;
  };

  const disabled = () => account === null || status === 'corrupt';

  /** Persist `next`; on success commit and return true, otherwise keep state and flag the error. */
  async function commit(next: Account): Promise<boolean> {
    try {
      account = await saveAccount(next, primary, mirror, now(), SAVE_TIMEOUT_MS);
      saveError = false;
      return true;
    } catch {
      saveError = true;
      return false;
    }
  }

  function act(change: (a: Account) => Account, nextToast: (a: Account) => Toast) {
    return enqueue(async () => {
      if (disabled() || !account) return;
      const next = change(account);
      if (await commit(next)) toast = nextToast(next);
    });
  }

  return {
    get account() {
      return account;
    },
    get status() {
      return status;
    },
    get saveError() {
      return saveError;
    },
    get toast() {
      return toast;
    },
    get lastBackupAt() {
      return lastBackupAt;
    },
    get balanceCents() {
      return account ? balanceCents(account) : 0;
    },
    get coffeesLeft() {
      return account ? coffeesLeft(account) : 0;
    },
    get disabled() {
      return disabled();
    },

    async init() {
      const result = await loadAccount(primary, mirror, now());
      account = result.account;
      status = result.status;
      try {
        lastBackupAt = parseBackupTs(await meta.get(LAST_BACKUP_KEY));
      } catch {
        lastBackupAt = null;
      }
    },

    drink: () =>
      act(
        (a) => drink(a, newId(), now()),
        (a) => ({ kind: 'coffee', cents: a.priceCents, undoable: true, eventId: a.events.at(-1)!.id }),
      ),
    topUp: (cents) =>
      act(
        (a) => topUp(a, cents, newId(), now()),
        (a) => ({ kind: 'topup', cents, undoable: true, eventId: a.events.at(-1)!.id }),
      ),
    setPrice: (cents) =>
      act(
        (a) => setPrice(a, cents),
        () => ({ kind: 'price', cents, undoable: false }),
      ),

    undo(eventId) {
      return enqueue(async () => {
        if (disabled() || !account) return;
        if (account.events.at(-1)?.id !== eventId) {
          toast = null;
          return;
        }
        if (await commit(undo(account).account)) toast = null;
      });
    },

    dismissToast() {
      toast = null;
    },

    async markBackedUp() {
      const ts = now();
      try {
        await meta.set(LAST_BACKUP_KEY, String(ts));
        lastBackupAt = ts;
      } catch {
        // The backup file was still downloaded; only the reminder date is lost.
      }
    },

    applyExternal(raw) {
      const next = parseAccount(raw);
      if (!next) return;
      if (account && status !== 'corrupt' && next.updatedAt <= account.updatedAt) return;
      account = next;
      status = 'ok';
      toast = null;
      saveError = false;
    },

    applyExternalBackup(raw) {
      const ts = parseBackupTs(raw);
      if (ts !== null) lastBackupAt = ts;
    },

    importAccount(a) {
      let ok = false;
      return enqueue(async () => {
        ok = await commit(a);
        if (ok) {
          status = 'ok';
          toast = null;
        }
      }).then(() => ok);
    },
  };
}
