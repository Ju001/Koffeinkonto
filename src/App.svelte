<script lang="ts">
  import { onMount } from 'svelte';
  import { exportAccount, parseAccount } from './lib/account';
  import { formatBackupDate } from './lib/dates';
  import { formatEuro } from './lib/money';
  import { STORAGE_KEY } from './lib/persistence';
  import { indexedDbKV, localStorageKV, requestPersistentStorage } from './lib/kv';
  import { createStore } from './lib/store.svelte';
  import AmountSheet from './components/AmountSheet.svelte';
  import Cup from './components/Cup.svelte';
  import Toast from './components/Toast.svelte';

  const store = createStore({ primary: localStorageKV, mirror: indexedDbKV, meta: localStorageKV });

  const TOPUP_PRESETS = [500, 1000, 2000];
  let persisted = $state<boolean | null>(null);
  let importError = $state('');
  let sheet = $state<'topup' | 'price' | null>(null);

  const price = $derived(store.account?.priceCents ?? 20);
  const owed = $derived(store.balanceCents < 0);

  onMount(() => {
    // Another tab wrote: follow it so this tab never exports or overwrites stale data.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) store.applyExternal(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    void (async () => {
      await store.init();
      persisted = await requestPersistentStorage();
    })();
    return () => window.removeEventListener('storage', onStorage);
  });

  function downloadBackup() {
    if (!store.account || store.status === 'corrupt') return;
    const blob = new Blob([exportAccount(store.account)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `koffeinkonto-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    // Revoking synchronously can cancel the download on iOS Safari.
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    void store.markBackedUp();
  }

  async function importBackup(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const parsed = parseAccount(await file.text());
    if (!parsed) {
      importError = 'This file is not a valid Koffeinkonto backup.';
      return;
    }
    importError = (await store.importAccount(parsed))
      ? ''
      : 'Could not save: browser storage is unavailable.';
  }
</script>

<main>
  <h1>Koffeinkonto</h1>

  {#if store.status === 'restored'}
    <p class="notice" data-testid="restore-notice">Your account was recovered from a backup copy.</p>
  {:else if store.status === 'corrupt'}
    <p class="notice" role="alert" data-testid="corrupt-notice">
      Stored data could not be read. Import a backup to recover it.
    </p>
  {/if}
  {#if store.saveError}
    <p class="notice" role="alert" data-testid="save-error">
      Could not save – browser storage is unavailable.
    </p>
  {/if}

  <section class="balance" aria-label="Balance">
    <div class="count" data-testid="coffees-left">{store.coffeesLeft}</div>
    <div class="count-label">coffees left</div>
    <p class="money">
      <span data-testid="balance">
        {owed ? `Owed ${formatEuro(-store.balanceCents)}` : formatEuro(store.balanceCents)}
      </span>
    </p>
  </section>

  <Cup disabled={store.disabled} onclick={() => store.drink()} />

  <Toast toast={store.toast} onundo={() => store.undo()} ondismiss={() => store.dismissToast()} />

  <div class="actions">
    <button type="button" class="primary" disabled={store.disabled} onclick={() => (sheet = 'topup')}>
      Top up
    </button>
    <button
      type="button"
      class="secondary"
      disabled={store.disabled}
      aria-label={`Price per coffee: ${formatEuro(price)}`}
      data-testid="price"
      onclick={() => (sheet = 'price')}
    >
      {formatEuro(price)}
    </button>
  </div>

  <footer>
    <p class="muted" data-testid="last-backup">
      Last backup: {formatBackupDate(store.lastBackupAt, Date.now())}
    </p>
    {#if persisted !== null}
      <p class="muted" data-testid="storage-status">
        {persisted
          ? 'Storage protected.'
          : 'The browser may clear this data. Export a backup regularly.'}
      </p>
    {/if}
    <div class="links">
      <button type="button" disabled={!store.account || store.status === 'corrupt'} onclick={downloadBackup}>
        Export backup
      </button>
      <label class="button">
        Import backup
        <input
          type="file"
          accept="application/json"
          data-testid="import-input"
          onchange={importBackup}
          hidden
        />
      </label>
    </div>
    {#if importError}
      <p role="alert" data-testid="import-error">{importError}</p>
    {/if}
  </footer>
</main>

<AmountSheet
  open={sheet === 'topup'}
  title="Top up"
  presets={TOPUP_PRESETS}
  confirmLabel={(c) => `Add ${formatEuro(c)}`}
  onclose={() => (sheet = null)}
  onconfirm={(c) => {
    sheet = null;
    void store.topUp(c);
  }}
>
  {#snippet preview(c)}
    = {Math.floor(c / price)} coffees at {formatEuro(price)}
  {/snippet}
</AmountSheet>

<AmountSheet
  open={sheet === 'price'}
  title="Price per coffee"
  initial={formatEuro(price).replace(/\s?€/, '').trim()}
  hint="Only affects future coffees."
  confirmLabel={(c) => `Set price to ${formatEuro(c)}`}
  onclose={() => (sheet = null)}
  onconfirm={(c) => {
    sheet = null;
    void store.setPrice(c);
  }}
/>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: min(100%, 420px);
    min-height: 100dvh;
    margin: 0 auto;
    padding: 24px 20px calc(20px + env(safe-area-inset-bottom));
  }

  h1 {
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .balance {
    margin-top: 4px;
  }

  .count {
    font-family: var(--font-num);
    font-size: 4.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
  }

  .count-label,
  .money {
    margin: 6px 0 0;
    color: var(--muted);
  }

  .notice {
    margin: 0;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--surface);
  }

  .actions {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-top: auto;
  }

  .actions button,
  .links .button,
  .links button {
    min-height: 48px;
    border: 0;
    border-radius: 14px;
    background: var(--surface);
    box-shadow: 0 1px 0 var(--surface-edge);
    font-weight: 700;
  }

  .primary {
    flex: 1;
    color: var(--accent);
  }

  .secondary {
    flex: 0 0 110px;
    color: var(--muted);
    font-weight: 600;
  }

  footer {
    width: 100%;
  }

  .muted {
    margin: 4px 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .links {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 10px;
  }

  .links .button,
  .links button {
    display: inline-flex;
    align-items: center;
    padding: 0 16px;
    background: none;
    box-shadow: none;
    color: var(--accent);
    font-size: 0.9rem;
    cursor: pointer;
  }
</style>
