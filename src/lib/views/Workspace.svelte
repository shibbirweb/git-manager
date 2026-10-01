<script lang="ts">
  import ConflictsDialog from "$lib/merge/ConflictsDialog.svelte";
  import MergeView from "$lib/merge/MergeView.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { DEFAULT_PANEL_WIDTH, settings } from "$lib/stores/settings.svelte";
  import { untrack } from "svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import ResizeHandle from "$lib/ui/ResizeHandle.svelte";
  import ActivityBar from "./ActivityBar.svelte";
  import ChangesDiff from "./changes/ChangesDiff.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import FileExplorer from "./files/FileExplorer.svelte";
  import CommitTab from "$lib/log/CommitTab.svelte";
  import { isCommitTab } from "$lib/stores/commitTabs";
  import FileView from "./files/FileView.svelte";
  import ChangesView from "./ChangesView.svelte";
  import Header from "./Header.svelte";
  import LogView from "./LogView.svelte";
  import OpBanner from "./OpBanner.svelte";
  import NoRepository from "./NoRepository.svelte";
  import EditorTabs from "./EditorTabs.svelte";
  import EmptyMain from "./EmptyMain.svelte";
  import RightActivityBar from "./RightActivityBar.svelte";
  import StatusBar from "./StatusBar.svelte";
  import Sidebar from "./Sidebar.svelte";
  import { workspaceShortcut } from "./workspaceShortcuts";

  const MIN_PANEL = 200;
  // The editor area always keeps at least this much room.
  const MIN_MAIN = 360;
  /** Left and right activity bars. */
  const ACTIVITY_BARS = 88;

  let bodyWidth = $state(0);
  const leftOpen = $derived(settings.leftPanel !== null);
  const shownView = $derived(changesSelection.shownView);

  const sidebarMax = $derived(
    Math.max(MIN_PANEL, bodyWidth - ACTIVITY_BARS - MIN_MAIN - (settings.explorerOpen ? settings.explorerWidth : 0)),
  );
  const explorerMax = $derived(
    Math.max(MIN_PANEL, bodyWidth - ACTIVITY_BARS - MIN_MAIN - (leftOpen ? settings.sidebarWidth : 0)),
  );
  const sidebarWidth = $derived(Math.min(settings.sidebarWidth, sidebarMax));
  const explorerWidth = $derived(Math.min(settings.explorerWidth, explorerMax));

  // The selected change must stay valid even while the Changes sidebar is hidden.
  $effect(() => {
    void repoStore.statuses;
    void repoStore.repos;
    untrack(() => changesSelection.sync());
  });

  // A new workspace starts with nothing selected and an empty Back / Forward history.
  $effect(() => {
    void repoStore.workspace?.root;
    untrack(() => {
      changesSelection.reset();
      navigation.clear();
    });
  });

  // Mouse side buttons navigate like in a browser or VS Code.
  function onMouseUp(event: MouseEvent): void {
    if (event.button === 3) {
      event.preventDefault();
      void navigation.goBack();
    } else if (event.button === 4) {
      event.preventDefault();
      void navigation.goForward();
    }
  }

  /** Cmd+B toggles the sidebar, Shift+Cmd+G / Shift+Cmd+E pick a panel (VS Code keys). */
  function onKeydown(event: KeyboardEvent): void {
    const shortcut = workspaceShortcut(event, {
      dialogOpen: dialogs.active !== null,
      mergeOpen: repoStore.mergeTarget !== null,
    });
    if (!shortcut) {
      return;
    }
    event.preventDefault();
    switch (shortcut) {
      case "goBack":
        void navigation.goBack();
        break;
      case "goForward":
        void navigation.goForward();
        break;
      case "toggleExplorer":
        settings.toggleExplorer();
        break;
      case "toggleSidebar":
        settings.setLeftPanel(settings.leftPanel === null ? "changes" : null);
        break;
      case "showChanges":
        settings.setLeftPanel("changes");
        break;
      case "showBranches":
        settings.setLeftPanel("branches");
        break;
      case "toggleLog":
        changesSelection.toggleLog();
        break;
    }
  }
</script>

<svelte:window onkeydown={onKeydown} onmouseup={onMouseUp} />

<div class="workspace">
  <Header />
  <OpBanner />
  <div class="body" bind:clientWidth={bodyWidth}>
    <ActivityBar />
    {#if leftOpen}
    <aside class="sidebar" style="width: {sidebarWidth}px">
      {#if settings.leftPanel === "changes"}
        <ChangesView />
      {:else if repoStore.repo}
        {#key repoStore.repo.root}
          <Sidebar />
        {/key}
      {:else}
        <NoRepository compact />
      {/if}
    </aside>
    <ResizeHandle
      label="Resize sidebar"
      panel="left"
      width={sidebarWidth}
      min={MIN_PANEL}
      max={sidebarMax}
      defaultWidth={DEFAULT_PANEL_WIDTH}
      onResize={(width) => (settings.sidebarWidth = width)}
      onCommit={() => settings.save()}
    />
    {/if}
    <main class="main">
      {#if changesSelection.selected || repoStore.tabs.length > 0}
        <EditorTabs />
      {/if}
      {#if shownView === "diff"}
        <ChangesDiff />
      {:else if shownView === "log"}
        {#if repoStore.repo}
          <LogView />
        {:else}
          <NoRepository />
        {/if}
      {:else if shownView === "none"}
        <EmptyMain />
      {/if}
      <!-- Every tab keeps its editor mounted, so unsaved edits, cursor and scroll survive switching. -->
      {#each repoStore.tabs as tab (tab.path)}
        <div class="file-host" class:hidden={shownView !== "file" || repoStore.openFilePath !== tab.path}>
          {#if isCommitTab(tab.path)}
            <CommitTab tabPath={tab.path} />
          {:else}
            <FileView filePath={tab.path} />
          {/if}
        </div>
      {/each}
    </main>
    {#if settings.explorerOpen}
      <ResizeHandle
        label="Resize files sidebar"
        panel="right"
        width={explorerWidth}
        min={MIN_PANEL}
        max={explorerMax}
        defaultWidth={DEFAULT_PANEL_WIDTH}
        onResize={(width) => (settings.explorerWidth = width)}
        onCommit={() => settings.save()}
      />
      <aside class="explorer" style="width: {explorerWidth}px">
        <FileExplorer />
      </aside>
    {/if}
    <RightActivityBar />
  </div>
  <StatusBar />
</div>

{#if repoStore.conflictsOpen && !repoStore.mergeTarget}
  <ConflictsDialog />
{/if}

{#if repoStore.mergeTarget && repoStore.repo}
  {#key repoStore.mergeTarget}
    <MergeView repoPath={repoStore.repo.root} conflictPath={repoStore.mergeTarget} />
  {/key}
{/if}

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .sidebar {
    flex: none;
    border-right: 1px solid var(--border-strong);
    background: var(--panel);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--panel);
  }

  .file-host {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .file-host.hidden {
    display: none;
  }

  .explorer {
    flex: none;
    border-left: 1px solid var(--border-strong);
    background: var(--panel);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
