<script lang="ts">
  import type { Snippet } from 'svelte';
  import { formatEuro, parseEuro } from '../lib/money';
  import Sheet from './Sheet.svelte';

  // Shared by top-up and price setting: one validated euro field with a labelled confirm.
  let {
    open,
    title,
    initial = '',
    presets = [],
    confirmLabel,
    onclose,
    onconfirm,
    hint,
    preview,
  }: {
    open: boolean;
    title: string;
    initial?: string;
    presets?: number[];
    confirmLabel: (cents: number) => string;
    onclose: () => void;
    onconfirm: (cents: number) => void;
    hint?: string;
    preview?: Snippet<[number]>;
  } = $props();

  let value = $state('');
  const cents = $derived(parseEuro(value));

  $effect(() => {
    if (open) value = initial;
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (cents !== null) onconfirm(cents);
  }
</script>

<Sheet {open} {title} {onclose}>
  <form onsubmit={submit}>
    {#if presets.length}
      <div class="chips">
        {#each presets as p (p)}
          <button type="button" class="chip" onclick={() => (value = String(p / 100))}>
            {formatEuro(p).replace(',00', '')}
          </button>
        {/each}
      </div>
    {/if}

    <label>
      Amount in euros
      <input
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0,00"
        bind:value
        aria-describedby="amount-help"
        data-testid="amount-input"
      />
    </label>

    <p id="amount-help" class="help" data-testid="amount-help">
      {#if cents !== null && preview}
        {@render preview(cents)}
      {:else if value.trim() !== '' && cents === null}
        Enter an amount like 7,50 (up to 10.000 €).
      {:else if hint}
        {hint}
      {/if}
    </p>

    <button type="submit" class="confirm" disabled={cents === null}>
      {cents === null ? 'Enter an amount' : confirmLabel(cents)}
    </button>
  </form>
</Sheet>

<style>
  .chips {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }

  .chip {
    flex: 1;
    min-height: 44px;
    border: 0;
    border-radius: 14px;
    background: var(--surface);
    box-shadow: 0 1px 0 var(--surface-edge);
    color: var(--accent);
    font-weight: 700;
  }

  label {
    display: block;
    color: var(--muted);
    font-size: 0.9rem;
  }

  input {
    display: block;
    width: 100%;
    min-height: 48px;
    margin-top: 6px;
    padding: 0 14px;
    border: 2px solid var(--surface-edge);
    border-radius: 14px;
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: 1.1rem;
  }

  .help {
    min-height: 1.4em;
    margin: 8px 0 16px;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .confirm {
    width: 100%;
    min-height: 48px;
    border: 0;
    border-radius: 14px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }
</style>
