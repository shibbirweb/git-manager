<script lang="ts">
  import ConflictsDialog from "$lib/merge/ConflictsDialog.svelte";
  import MergeView from "$lib/merge/MergeView.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { DEFAULT_PANEL_WIDTH, DEFAULT_TERMINAL_HEIGHT, MIN_TERMINAL_HEIGHT, settings } from "$lib/stores/settings.svelte";
  import TerminalHost from "$lib/terminal/TerminalHost.svelte";
  import TerminalPanel from "$lib/terminal/TerminalPanel.svelte";
  import TerminalSlot from "$lib/terminal/TerminalSlot.svelte";
  import { parseTerminalTabPath } from "$lib/terminal/terminalTabs";
  import { clampPanelHeight } from "$lib/terminal/terminals";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import { onDestroy, onMount, untrack } from "svelte";
  import { DoubleShift } from "$lib/search/doubleShift";
  import FileSearch from "$lib/search/FileSearch.svelte";
  import { fileSearch } from "$lib/search/fileSearchStore.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import ResizeHandle from "$lib/ui/ResizeHandle.svelte";
  import ActivityBar from "./ActivityBar.svelte";
  import ChangesDiff from "./changes/ChangesDiff.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { gitDialogs } from "./git/gitDialogs.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import FileExplorer from "./files/FileExplorer.svelte";
  import CommitTab from "$lib/log/CommitTab.svelte";
  import { isCommitTab } from "$lib/stores/commitTabs";
  import { isGitTab } from "$lib/stores/gitTabs";
  import GitTab from "./git/GitTab.svelte";
  import BranchTab from "./git/BranchTab.svelte";
  import { isBranchTab } from "$lib/stores/branchTabs";
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
  import { openFileSearch, runWorkspaceShortcut } from "./workspaceActions";
  import { followOpenTab } from "./repoSelection.svelte";
  import { workspaceShortcut } from "./workspaceShortcuts";

  const MIN_PANEL = 200;
  // The editor area always keeps at least this much room.
  const MIN_MAIN = 360;
  /** Width of one icon strip at the window edge (the left and right activity bars). */
  const ACTIVITY_BAR_WIDTH = 44;
  const ACTIVITY_BARS = $derived(ACTIVITY_BAR_WIDTH * (Number(settings.leftBarVisible) + Number(settings.rightBarVisible)));
  /** The editor keeps at least this much height above the terminal panel. */
  const MIN_EDITOR_HEIGHT = 120;
  // Loaded the first time the Scripts panel shows.
  const loadScriptsPanel = () => import("$lib/scripts/ScriptsPanel.svelte");

  let bodyWidth = $state(0);
  let mainHeight = $state(0);
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
  const terminalMax = $derived(Math.max(MIN_TERMINAL_HEIGHT, mainHeight - MIN_EDITOR_HEIGHT));
  const terminalHeight = $derived(clampPanelHeight(settings.terminalHeight, MIN_TERMINAL_HEIGHT, terminalMax));

  // Closing the workspace (Close Folder) stops its shells.
  onDestroy(() => terminalStore.closeAll());

  // The selected change must stay valid even while the Changes sidebar is hidden.
  $effect(() => {
    void repoStore.statuses;
    void repoStore.repos;
    untrack(() => changesSelection.sync());
  });

  // With Auto (status bar repository picker), the active repository follows the open tab.
  followOpenTab();

  // A new workspace starts with nothing selected and an empty Back / Forward history.
  $effect(() => {
    void repoStore.workspace?.root;
    untrack(() => {
      changesSelection.reset();
      navigation.clear();
    });
  });

  // Double Shift opens Search Everywhere, like JetBrains. Capture phase, so it is seen
  // even when an editor or the terminal handles the key itself.
  const doubleShift = new DoubleShift();
  onMount(() => {
    const onShiftKey = (event: KeyboardEvent) => {
      if (doubleShift.handle(event) && !fileSearch.isOpen) {
        openFileSearch("everywhere");
      }
    };
    const onBlur = () => doubleShift.reset();
    window.addEventListener("keydown", onShiftKey, true);
    window.addEventListener("keyup", onShiftKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onShiftKey, true);
      window.removeEventListener("keyup", onShiftKey, true);
      window.removeEventListener("blur", onBlur);
    };
  });

  // Closing the workspace closes the popup too.
  onDestroy(() => fileSearch.close());

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

  /**
   * Cmd+B toggles the sidebar, Shift+Cmd+G / Shift+Cmd+E pick a panel, Ctrl+` the terminal (VS Code keys);
   * Cmd+P / Shift+Cmd+O, Cmd+O, Option+Cmd+O and Shift+Cmd+F open Search Everywhere on Files, Classes,
   * Symbols and Text, and Shift+Cmd+R on Text with Replace (JetBrains keys).
   */
  function onKeydown(event: KeyboardEvent): void {
    const shortcut = workspaceShortcut(event, {
      dialogOpen: dialogs.active !== null || gitDialogs.active !== null || fileSearch.isOpen,
      mergeOpen: repoStore.mergeTarget !== null,
    });
    if (!shortcut) {
      return;
    }
    // The View and Edit menus show these keys too; the page sees a key first, so preventing
    // its default here keeps the menu item from running it a second time.
    event.preventDefault();
    runWorkspaceShortcut(shortcut);
  }
</script>

<svelte:window onkeydown={onKeydown} onmouseup={onMouseUp} />

<div class="workspace">
  <Header />
  <OpBanner />
  <div class="body" bind:clientWidth={bodyWidth}>
    {#if settings.leftBarVisible}
      <ActivityBar />
    {/if}
    {#if leftOpen}
    <aside class="sidebar" style="width: {sidebarWidth}px">
      {#if settings.leftPanel === "changes"}
        <ChangesView />
      {:else if settings.leftPanel === "scripts"}
        {#await loadScriptsPanel() then module}
          <module.default />
        {/await}
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
      size={sidebarWidth}
      min={MIN_PANEL}
      max={sidebarMax}
      defaultSize={DEFAULT_PANEL_WIDTH}
      onResize={(width) => (settings.sidebarWidth = width)}
      onCommit={() => settings.save()}
    />
    {/if}
    <main class="main" bind:clientHeight={mainHeight}>
      <div class="editor-area">
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
          {@const terminalKey = parseTerminalTabPath(tab.path)}
          <div class="file-host" class:hidden={shownView !== "file" || repoStore.openFilePath !== tab.path}>
            {#if terminalKey !== null}
              <TerminalSlot {terminalKey} />
            {:else if isCommitTab(tab.path)}
              <CommitTab tabPath={tab.path} />
            {:else if isGitTab(tab.path)}
              <GitTab tabPath={tab.path} />
            {:else if isBranchTab(tab.path)}
              <BranchTab tabPath={tab.path} />
            {:else}
              <FileView filePath={tab.path} />
            {/if}
          </div>
        {/each}
      </div>
      {#if terminalStore.started}
        {#if terminalStore.panelOpen}
          <ResizeHandle
            label="Resize terminal panel"
            panel="bottom"
            size={terminalHeight}
            min={MIN_TERMINAL_HEIGHT}
            max={terminalMax}
            defaultSize={DEFAULT_TERMINAL_HEIGHT}
            onResize={(height) => (settings.terminalHeight = height)}
            onCommit={() => settings.save()}
          />
        {/if}
        <TerminalPanel height={terminalHeight} />
      {/if}
    </main>
    {#if settings.explorerOpen}
      <ResizeHandle
        label="Resize files sidebar"
        panel="right"
        size={explorerWidth}
        min={MIN_PANEL}
        max={explorerMax}
        defaultSize={DEFAULT_PANEL_WIDTH}
        onResize={(width) => (settings.explorerWidth = width)}
        onCommit={() => settings.save()}
      />
      <aside class="explorer" style="width: {explorerWidth}px">
        <FileExplorer />
      </aside>
    {/if}
    {#if settings.rightBarVisible}
      <RightActivityBar />
    {/if}
  </div>
  <StatusBar />
  <!-- Every terminal, mounted once; each is moved into the panel or its editor tab. -->
  <TerminalHost />
</div>

{#if repoStore.conflictsOpen && !repoStore.mergeTarget}
  <ConflictsDialog />
{/if}

{#if fileSearch.isOpen}
  <FileSearch />
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

  .editor-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
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
