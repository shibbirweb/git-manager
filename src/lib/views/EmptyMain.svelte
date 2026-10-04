<!-- Main area when no diff, file or Log is open: the Navigation Bar on top, then ways to start. -->
<script lang="ts">
  import NavigationBar from "$lib/navBar/NavigationBar.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { openFileSearch, openNavigationBar, openQuickOpen } from "./workspaceActions";

  /** Jump to Navigation Bar lands here while the group showing this screen is focused. */
  const claimed = $derived(repoStore.focusedGroupId === repoStore.primaryGroupId);
</script>

<div class="welcome">
  <!-- The Navigation Bar over an empty editor: the active repository's path, on top or (Bottom) at the foot. -->
  {#if settings.fileToolbar === "top" && settings.fileToolbarBreadcrumbs}
    <div class="nav-strip">
      <NavigationBar targetPath={repoStore.repo?.root ?? null} targetIsDir {claimed} />
    </div>
  {/if}
  <div class="empty">
    <div class="logo"><Icon name="merge" size={28} /></div>
    <p class="title">{repoStore.workspace?.name ?? "Git Manager"}</p>
    <div class="actions">
      <button class="action" onclick={() => settings.setLeftPanel("changes")}>
        <Icon name="git-compare" size={15} />
        <span>Review changes</span>
        <kbd>Shift+Cmd+G</kbd>
      </button>
      <button class="action" onclick={() => changesSelection.toggleLog()} disabled={!repoStore.repo}>
        <Icon name="history" size={15} />
        <span>Show the Log</span>
        <kbd>Shift+Cmd+L</kbd>
      </button>
      <button
        class="action"
        onclick={() => {
          if (!settings.explorerOpen) {
            settings.toggleExplorer();
          }
        }}
      >
        <Icon name="list-tree" size={15} />
        <span>Open a file from the Files panel</span>
      </button>
      <button class="action" onclick={() => openQuickOpen("")}>
        <Icon name="file" size={15} />
        <span>Go to File</span>
        <kbd>Cmd+P</kbd>
      </button>
      <button class="action" onclick={() => openFileSearch("everywhere")}>
        <Icon name="search" size={15} />
        <span>Search Everywhere</span>
        <kbd>Shift Shift</kbd>
      </button>
      <button class="action" onclick={openNavigationBar}>
        <Icon name="chevrons-right" size={15} />
        <span>Navigation Bar</span>
        <kbd>Cmd+Up</kbd>
      </button>
    </div>
  </div>
  {#if settings.fileToolbar === "bottom" && settings.fileToolbarBreadcrumbs}
    <div class="nav-strip bottom">
      <NavigationBar targetPath={repoStore.repo?.root ?? null} targetIsDir {claimed} />
    </div>
  {/if}
</div>

<style>
  .welcome {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
  }

  /* The same slim bar as a file's path bar (FileView .file-bar). */
  .nav-strip {
    flex: none;
    display: flex;
    align-items: center;
    height: 29px;
    min-width: 0;
    padding: 0 6px 0 10px;
    overflow: hidden;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
    color: var(--text-dim);
    font-size: 12px;
  }

  .nav-strip.bottom {
    border-top: 1px solid var(--border-strong);
    border-bottom: none;
  }

  .empty {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    background: var(--editor-bg);
  }

  .logo {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
  }

  .title {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 300px;
  }

  .action {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-dim);
    text-align: left;
    cursor: pointer;
  }

  .action:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .action span {
    flex: 1;
  }

  kbd {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-faint);
  }
</style>
