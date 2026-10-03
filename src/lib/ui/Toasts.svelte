<script lang="ts">
  import Icon from "./Icon.svelte";
  import { toast } from "./toast.svelte";
</script>

<div class="toasts">
  {#each toast.items as item (item.id)}
    <div class="toast {item.kind}" role="status">
      <div class="body">
        <div class="title">{item.title}</div>
        {#if item.detail}
          <pre class="detail selectable">{item.detail}</pre>
        {/if}
      </div>
      {#if item.action}
        <button class="btn small toast-action" onclick={() => toast.runAction(item.id)}>{item.action.label}</button>
      {/if}
      <button class="icon-btn close" onclick={() => toast.dismiss(item.id)} aria-label="Dismiss">
        <Icon name="x" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1000;
    max-width: 420px;
  }

  .toast {
    display: flex;
    gap: 8px;
    padding: 10px 8px 10px 12px;
    border-radius: 8px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-left: 4px solid var(--accent);
    box-shadow: var(--shadow);
  }

  .toast.success {
    border-left-color: var(--success);
  }

  .toast.error {
    border-left-color: var(--danger);
  }

  .toast.warning {
    border-left-color: var(--warning);
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-weight: 600;
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
  }

  .close {
    height: 22px;
    min-width: 22px;
  }

  .toast-action {
    flex: none;
    align-self: center;
  }
</style>
