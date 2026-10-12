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
    <p class="line" data-testid="balance-line">
      coffees left · <span data-testid="balance"
        >{owed ? `Owed ${formatEuro(-store.balanceCents)}` : formatEuro(store.balanceCents)}</span
      >
    </p>
  </section>

  <Cup disabled={store.disabled} onclick={() => store.drink()} />
  <p class="hint">Tap the cup to drink one</p>

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
    <p class="foot">
      <span data-testid="last-backup">Last backup: {formatBackupDate(store.lastBackupAt, Date.now())}</span
      ><span class="sep" aria-hidden="true">·</span><button
        type="button"
        class="link"
        aria-label="Export backup"
        disabled={!store.account || store.status === 'corrupt'}
        onclick={downloadBackup}>Export</button
      ><span class="sep" aria-hidden="true">·</span><label class="link">
        Import
        <input
          type="file"
          accept="application/json"
          aria-label="Import backup"
          data-testid="import-input"
          onchange={importBackup}
          hidden
        />
      </label>
    </p>
    {#if persisted === false}
      <p class="foot" data-testid="storage-status">
        The browser may clear this data. Export a backup regularly.
      </p>
    {:else if persisted}
      <p class="visually-hidden" data-testid="storage-status">Storage protected.</p>
    {/if}
    {#if importError}
      <p class="foot error" role="alert" data-testid="import-error">{importError}</p>
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
    width: min(100%, 440px);
    min-height: 100dvh;
    margin: 0 auto;
    padding: 28px 20px calc(16px + env(safe-area-inset-bottom));
  }

  h1 {
    margin: 0;
    color: var(--muted);
    font-size: 1rem;
    font-weight: 450;
    letter-spacing: 0.01em;
  }

  .notice {
    margin: 12px 0 0;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--surface);
  }

  .count {
    margin-top: 12px;
    color: var(--num);
    font-size: 6rem;
    font-weight: 800;
    font-variation-settings: 'opsz' 96;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    line-height: 0.95;
  }

  .line {
    margin: 10px 0 18px;
    color: var(--muted);
  }

  .hint {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-top: auto;
  }

  .actions button {
    min-height: 52px;
    border: 0;
    border-radius: 16px;
    background: var(--surface);
    box-shadow: 0 1px 0 var(--surface-edge);
  }

  .primary {
    flex: 1;
    color: var(--accent);
    font-weight: 700;
  }

  .secondary {
    flex: 0 0 104px;
    color: var(--muted);
    font-weight: 550;
  }

  footer {
    width: 100%;
    margin-top: 12px;
  }

  .foot {
    margin: 2px 0;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .sep {
    margin: 0 0.45em;
  }

  .error {
    color: var(--fg);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
