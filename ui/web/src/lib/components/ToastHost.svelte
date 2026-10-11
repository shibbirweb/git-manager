<!-- Draws the toasts in the bottom right corner: a colored edge for the kind, the title, an optional detail (kept
     selectable), an optional button and a close button. It shows `items`; the store decides when they go. -->
<script lang="ts">
  import type { ToastItem } from "../logic/toastModel";
  import Button from "./Button.svelte";
  import IconButton from "./IconButton.svelte";

  interface Props {
    items: ToastItem[];
    ondismiss: (id: number) => void;
    onaction?: (id: number) => void;
  }

  let { items, ondismiss, onaction }: Props = $props();
</script>

<div class="toasts">
  {#each items as item (item.id)}
    <div class="toast {item.kind}" role={item.kind === "error" ? "alert" : "status"}>
      <div class="body">
        <div class="title">{item.title}</div>
        {#if item.detail}
          <pre class="detail">{item.detail}</pre>
        {/if}
      </div>
      {#if item.action}
        <span class="toast-action">
          <Button size="small" onclick={() => onaction?.(item.id)}>{item.action.label}</Button>
        </span>
      {/if}
      <IconButton icon="x" label="Dismiss" size="small" iconSize={14} onclick={() => ondismiss(item.id)} />
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: var(--toast-offset);
    bottom: var(--toast-offset);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: var(--toast-gap);
    max-width: var(--toast-max-width);
  }

  .toast {
    display: flex;
    gap: var(--toast-gap);
    padding: var(--toast-padding-y) var(--toast-padding-right) var(--toast-padding-y) var(--toast-padding-left);
    border: 1px solid var(--border-strong);
    border-left: var(--toast-edge) solid var(--accent);
    border-radius: var(--toast-radius);
    background: var(--panel);
    box-shadow: var(--shadow);
  }

  .success {
    border-left-color: var(--success);
  }

  .error {
    border-left-color: var(--danger);
  }

  .warning {
    border-left-color: var(--warning);
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-weight: var(--font-weight-semibold);
  }

  .detail {
    margin: 4px 0 0;
    max-height: 160px;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 11.5px;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-dim);
    user-select: text;
    -webkit-user-select: text;
  }

  .toast-action {
    flex: none;
    align-self: center;
  }
</style>
