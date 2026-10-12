<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open,
    title,
    onclose,
    children,
  }: { open: boolean; title: string; onclose: () => void; children: Snippet } = $props();

  let dialog: HTMLDialogElement;

  // Native <dialog> gives the focus trap, Esc handling and focus restore.
  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function onDialogClick(event: MouseEvent) {
    if (event.target === dialog) onclose();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="sheet-title"
  onclose={() => open && onclose()}
  onclick={onDialogClick}
>
  <div class="body">
    <h2 id="sheet-title">{title}</h2>
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    width: min(100%, 420px);
    max-width: 100%;
    margin: auto auto 0;
    padding: 0;
    border: 0;
    border-radius: 24px 24px 0 0;
    background: var(--bg);
    color: var(--fg);
    text-align: left;
  }

  dialog::backdrop {
    background: rgb(30 23 18 / 0.5);
  }

  .body {
    padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
  }

  h2 {
    margin: 0 0 16px;
    font-size: 1.1rem;
  }
</style>
