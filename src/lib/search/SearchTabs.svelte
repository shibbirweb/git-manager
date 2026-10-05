<!-- The tab strip of the Search Everywhere popup; Tab and Shift+Tab are handled by the field. -->
<script lang="ts">
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import { SEARCH_TABS, type SearchTab } from "./searchTabs";

  let { tab, onSelect }: { tab: SearchTab; onSelect: (tab: SearchTab) => void } = $props();
</script>

<div class="tabs" role="tablist" aria-label="Search in">
  {#each SEARCH_TABS as info (info.id)}
    <button
      type="button"
      class="tab"
      class:active={info.id === tab}
      role="tab"
      aria-selected={info.id === tab}
      tabindex="-1"
      title={info.commandId ? withCommandKeys(info.label, info.commandId) : `${info.label} (Double Shift)`}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => onSelect(info.id)}
    >
      {info.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    align-items: stretch;
    gap: 2px;
    min-width: 0;
  }

  .tab {
    border: none;
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    font-size: 12.5px;
    padding: 6px 9px 5px;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    color: var(--text);
    font-weight: 600;
    border-bottom-color: var(--accent);
  }
</style>
