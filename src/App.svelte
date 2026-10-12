<script lang="ts">
  import { onMount } from 'svelte';
  import { exportAccount, parseAccount, type Account } from './lib/account';
  import { formatEuro } from './lib/money';
  import { loadAccount, saveAccount, type LoadStatus } from './lib/persistence';
  import { indexedDbKV, localStorageKV, requestPersistentStorage } from './lib/kv';

  let account = $state<Account | null>(null);
  let status = $state<LoadStatus | null>(null);
  let persisted = $state<boolean | null>(null);
  let importError = $state('');

  onMount(async () => {
    const result = await loadAccount(localStorageKV, indexedDbKV);
    account = result.account;
    status = result.status;
    persisted = await requestPersistentStorage();
  });

  function downloadBackup() {
    if (!account || status === 'corrupt') return;
    const blob = new Blob([exportAccount(account)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `koffeinkonto-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
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
    try {
      account = await saveAccount(parsed, localStorageKV, indexedDbKV);
      status = 'ok';
      importError = '';
    } catch {
      importError = 'Could not save: browser storage is unavailable.';
    }
  }
</script>

<main>
  <h1>Koffeinkonto</h1>
  <p>Your prepaid coffee account.</p>

  {#if account && status !== 'corrupt'}
    <p data-testid="account-summary">
      {account.events.length} entries · {formatEuro(account.priceCents)} per coffee
    </p>
  {/if}

  {#if status === 'restored'}
    <p data-testid="restore-notice">Your account was recovered from a backup copy.</p>
  {:else if status === 'corrupt'}
    <p data-testid="corrupt-notice">
      Stored data could not be read. Import a backup to recover it.
    </p>
  {/if}

  {#if persisted !== null}
    <p data-testid="storage-status">
      {persisted
        ? 'Storage protected.'
        : 'The browser may clear this data. Export a backup regularly.'}
    </p>
  {/if}

  <div class="actions">
    <button type="button" onclick={downloadBackup} disabled={!account || status === 'corrupt'}>Export backup</button>
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
</main>
