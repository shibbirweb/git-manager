<!-- The frame of the Git menu's dialogs: overlay, title, body and buttons. Escape cancels and
     Cmd+Enter (Ctrl+Enter) runs the main action, except while a confirmation is on top. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";

  interface Props {
    title: string;
    /** Width in pixels. */
    width?: number;
    /** False while working: Escape and the overlay do not close it then. */
    closable?: boolean;
    onCancel: () => void;
    /** Cmd+Enter; left out when there is no main action. */
    onSubmit?: () => void;
    children: Snippet;
    footer: Snippet;
  }

  let { title, width = 520, closable = true, onCancel, onSubmit, children, footer }: Props = $props();

  let dialogEl = $state<HTMLDivElement | null>(null);

  onMount(() => {
    // The first field gets the caret; a dialog without one focuses itself for the keys.
    const first =
      dialogEl?.querySelector<HTMLElement>("[data-autofocus]") ??
      dialogEl?.querySelector<HTMLElement>("input:not([type=checkbox]):not([type=radio]), textarea, select");
    (first ?? dialogEl)?.focus();
  });

  function onKeydown(event: KeyboardEvent): void {
    // A confirmation above this dialog handles its own keys (and prevents them).
    if (dialogs.active !== null || event.defaultPrevented) {
      return;
    }
    if (event.key === "Escape" && closable) {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="overlay"
  role="presentation"
  onmousedown={(event) => {
    if (event.target === event.currentTarget && closable) {
      onCancel();
    }
  }}
>
  <div
    class="dialog"
    bind:this={dialogEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="git-dialog-title"
    tabindex="-1"
    style="width: min({width}px, calc(100vw - 32px))"
  >
    <h2 id="git-dialog-title">{title}</h2>
    <div class="body">
      {@render children()}
    </div>
    <div class="actions">
      {@render footer()}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 850;
  }

  .dialog {
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 18px 20px 16px;
    outline: none;
  }

  h2 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  /* Shared by the dialogs' bodies. */
  .dialog :global(.field) {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .dialog :global(.field > span) {
    color: var(--text-dim);
    font-size: 12px;
  }

  .dialog :global(.row) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dialog :global(.check) {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dialog :global(.hint) {
    color: var(--text-faint);
    font-size: 12px;
  }

  .dialog :global(.error) {
    color: var(--danger);
    font-size: 12px;
  }

  .dialog :global(.command) {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-dim);
    background: var(--panel-alt);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 5px 8px;
    overflow-wrap: anywhere;
  }

  .dialog :global(.spacer) {
    flex: 1;
  }

  .dialog :global(.danger-fill) {
    background: var(--danger);
    border-color: var(--danger);
  }

  .dialog :global(.spinner) {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: git-dialog-spin 0.8s linear infinite;
  }

  @keyframes git-dialog-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
