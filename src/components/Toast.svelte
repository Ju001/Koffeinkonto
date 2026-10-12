<script lang="ts">
  import { formatEuro } from '../lib/money';
  import type { Toast } from '../lib/store.svelte';

  let {
    toast,
    onundo,
    ondismiss,
  }: { toast: Toast | null; onundo: () => void; ondismiss: () => void } = $props();

  const TOAST_MS = 5000;

  // Re-arms for every new toast object, so a second identical action restarts the timer.
  $effect(() => {
    if (!toast) return;
    const timer = setTimeout(ondismiss, TOAST_MS);
    return () => clearTimeout(timer);
  });

  const text = (t: Toast) =>
    t.kind === 'coffee'
      ? 'Coffee recorded'
      : t.kind === 'topup'
        ? `Added ${formatEuro(t.cents)}`
        : `Price set to ${formatEuro(t.cents)}`;
</script>

<div class="slot" role="status" aria-live="polite">
  {#if toast}
    <div class="toast" data-testid="toast">
      <span>{text(toast)}</span>
      {#if toast.undoable}
        <button type="button" onclick={onundo}>Undo</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .slot {
    min-height: 52px;
    width: 100%;
  }

  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 8px 6px 16px;
    border-radius: 14px;
    background: var(--toast-bg);
    color: var(--toast-fg);
    text-align: left;
  }

  button {
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--crema);
    font-weight: 700;
  }
</style>
