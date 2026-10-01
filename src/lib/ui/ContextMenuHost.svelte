<script lang="ts">
  import { contextMenu, type MenuItem } from "./menu.svelte";

  let menuEl = $state<HTMLDivElement | null>(null);
  let left = $state(0);
  let top = $state(0);

  // Keep the menu inside the window.
  $effect(() => {
    if (!contextMenu.visible || !menuEl) {
      return;
    }
    const rect = menuEl.getBoundingClientRect();
    left = Math.min(contextMenu.x, window.innerWidth - rect.width - 4);
    top = Math.min(contextMenu.y, window.innerHeight - rect.height - 4);
  });

  function run(item: MenuItem): void {
    if ("separator" in item || item.disabled) {
      return;
    }
    contextMenu.close();
    item.action();
  }
</script>

<svelte:window
  onmousedown={(event) => {
    if (contextMenu.visible && menuEl && !menuEl.contains(event.target as Node)) {
      contextMenu.close();
    }
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") {
      contextMenu.close();
    }
  }}
  onblur={() => contextMenu.close()}
/>

{#if contextMenu.visible}
  <div bind:this={menuEl} class="menu" role="menu" style="left: {left || contextMenu.x}px; top: {top || contextMenu.y}px;">
    {#each contextMenu.items as item, index (index)}
      {#if "separator" in item}
        <div class="separator"></div>
      {:else}
        <button
          class="item"
          class:danger={item.danger}
          role="menuitem"
          disabled={item.disabled}
          onclick={() => run(item)}
        >
          <span>{item.label}</span>
          {#if item.hint}
            <span class="hint">{item.hint}</span>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 950;
    min-width: 200px;
    padding: 4px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
  }

  .item {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .item:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-text);
  }

  .item:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .item.danger {
    color: var(--danger);
  }

  .item.danger:hover:not(:disabled) {
    background: var(--danger);
    color: #fff;
  }

  .hint {
    color: var(--text-faint);
  }

  .separator {
    height: 1px;
    margin: 4px 6px;
    background: var(--border-strong);
  }
</style>
