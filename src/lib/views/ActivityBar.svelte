<!-- VS Code style activity bar: picks what the left sidebar shows, or hides it. -->
<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import { type LeftPanel, settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import type { IconName } from "$lib/ui/icons";
  import { changesSelection } from "./changes/selection.svelte";

  interface Item {
    panel: Exclude<LeftPanel, null>;
    icon: IconName;
    label: string;
    shortcut: string;
  }

  const items: Item[] = [
    { panel: "changes", icon: "git-compare", label: "Changes", shortcut: "Shift+Cmd+G" },
    { panel: "branches", icon: "branch", label: "Branches and Stashes", shortcut: "Shift+Cmd+E" },
  ];

  const conflicts = $derived(
    Object.values(repoStore.statuses).reduce(
      (sum, status) => sum + status.files.filter((file) => file.conflicted).length,
      0,
    ),
  );
</script>

<nav class="activity" aria-label="Sidebar">
  {#each items as item (item.panel)}
    {@const active = settings.leftPanel === item.panel}
    <button
      class="item"
      class:active
      onclick={() => settings.toggleLeftPanel(item.panel)}
      title="{item.label} ({item.shortcut}){active ? ', click to hide' : ''}"
      aria-label={item.label}
      aria-pressed={active}
    >
      <Icon name={item.icon} size={19} strokeWidth={1.8} />
      {#if item.panel === "changes" && repoStore.totalChanges > 0}
        <span class="badge" class:conflict={conflicts > 0}>{repoStore.totalChanges > 99 ? "99+" : repoStore.totalChanges}</span>
      {/if}
    </button>
  {/each}
  <div class="separator"></div>
  <!-- The Log opens in the main area rather than in the sidebar. -->
  <button
    class="item"
    class:active={changesSelection.shownView === "log"}
    onclick={() => changesSelection.toggleLog()}
    title="Log: commit history and graph (Shift+Cmd+L){changesSelection.shownView === 'log' ? ', click to hide' : ''}"
    aria-label="Log"
    aria-pressed={changesSelection.shownView === "log"}
  >
    <Icon name="history" size={19} strokeWidth={1.8} />
  </button>
</nav>

<style>
  .activity {
    flex: none;
    width: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-top: 6px;
    background: var(--panel-alt);
    border-right: 1px solid var(--border-strong);
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .item:hover {
    color: var(--text);
    background: var(--hover);
  }

  .item.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .item.active::before {
    content: "";
    position: absolute;
    left: -4px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    border-radius: 2px;
    background: var(--accent);
  }

  .separator {
    width: 22px;
    height: 1px;
    margin: 4px 0;
    background: var(--border-strong);
  }

  .badge {
    position: absolute;
    right: 1px;
    bottom: 3px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
  }

  .badge.conflict {
    background: var(--danger);
  }
</style>
