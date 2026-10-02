<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { viewLabel, watchScrolling } from "$lib/debug/memoryEvents";
  import { helpDialogs } from "$lib/help/helpDialogs.svelte";
  import { memoryLog } from "$lib/debug/memoryLog.svelte";
  import { WheelZoom } from "$lib/editor/wheelZoom";
  import { cursorOptions, setEditorCursor } from "$lib/editor/cursor";
  import { featureOptions } from "$lib/editor/featurePlan";
  import { setEditorFeatures } from "$lib/editor/features";
  import { setRenderWhitespace } from "$lib/editor/whitespace";
  import { setWordWrap } from "$lib/editor/wordWrap";
  import { appMenu } from "$lib/menu/appMenu.svelte";
  import { startMcpBridge } from "$lib/mcp/bridge";
  import { mcpStore } from "$lib/mcp/mcpStore.svelte";
  import MergeToolApp from "$lib/merge/MergeToolApp.svelte";
  import { fileCommands } from "$lib/stores/fileCommands.svelte";
  import { isWorkspaceFile, repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { sessionSteps } from "$lib/stores/settingsData";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import type { LaunchMode } from "$lib/types";
  import ContextMenuHost from "$lib/ui/ContextMenuHost.svelte";
  import DialogHost from "$lib/ui/DialogHost.svelte";
  import Toasts from "$lib/ui/Toasts.svelte";
  import GitDialogHost from "$lib/views/git/GitDialogHost.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import SettingsDialog from "$lib/views/SettingsDialog.svelte";
  import UpdateDialog from "$lib/update/UpdateDialog.svelte";
  import { updates } from "$lib/update/updates.svelte";
  import WhatsNewDialog from "$lib/update/WhatsNewDialog.svelte";
  import OpeningProgress from "$lib/views/OpeningProgress.svelte";
  import Welcome from "$lib/views/Welcome.svelte";
  import Workspace from "$lib/views/Workspace.svelte";
  import { changesSelection } from "$lib/views/changes/selection.svelte";
  import { syncWorkspaceFolders } from "$lib/views/files/previewScheme";

  let launch = $state<LaunchMode | null>(null);
  /** Font size badge shown briefly while zooming with the mouse wheel. */
  let zoomBadge = $state<number | null>(null);
  let zoomBadgeTimer: ReturnType<typeof setTimeout> | undefined;
  const wheelZoom = new WheelZoom();
  let settingsLoaded = $state(false);

  // The backend records git commands only while the Git Console setting is on.
  $effect(() => {
    if (!settingsLoaded) {
      return;
    }
    const enabled = settings.gitConsole;
    if (!enabled) {
      untrack(() => terminalStore.closeGitConsole());
    }
    api.gitConsoleSetEnabled(enabled).catch(() => undefined);
  });

  // The MCP server and the command line tool run while either switch is on. Only the main
  // window drives them: a git mergetool window would compete for the same port.
  const mainWindow = $derived(settingsLoaded && launch?.mode === "app");
  $effect(() => {
    if (!mainWindow) {
      return;
    }
    const enabled = settings.mcpEnabled;
    const cliEnabled = settings.cliEnabled;
    const port = settings.mcpPort;
    const toolStates = settings.mcpTools;
    untrack(() => void mcpStore.configure(enabled, cliEnabled, port, toolStates));
  });

  $effect(() => {
    if (!mainWindow) {
      return;
    }
    return untrack(() => startMcpBridge());
  });

  // Tools and the image and PDF previews only reach the folders open now.
  const workspaceFolderKey = $derived((repoStore.workspace?.folders ?? []).map((folder) => folder.root).join("\n"));
  $effect(() => {
    if (!mainWindow) {
      return;
    }
    const folderPaths = workspaceFolderKey ? workspaceFolderKey.split("\n") : [];
    syncWorkspaceFolders(folderPaths);
  });

  // The debug memory log (Settings > Automation): the backend reads memory, the window reports
  // what is on screen and when scrolling starts and stops, so each change has its cause.
  $effect(() => {
    if (!mainWindow) {
      return;
    }
    const enabled = settings.memoryLogEnabled;
    const intervalMs = settings.memoryLogIntervalMs;
    const thresholdMb = settings.memoryLogThresholdMb;
    untrack(() => void memoryLog.configure(enabled, intervalMs, thresholdMb));
  });

  function logMemoryEvent(label: string): void {
    api.memoryLogEvent(label).catch(() => undefined);
  }

  $effect(() => {
    if (!mainWindow || !settings.memoryLogEnabled) {
      return;
    }
    return untrack(() => watchScrolling(logMemoryEvent));
  });

  let lastViewLabel = "";
  $effect(() => {
    if (!mainWindow || !settings.memoryLogEnabled) {
      lastViewLabel = "";
      return;
    }
    const shownView = changesSelection.shownView;
    const tabPath = shownView === "file" ? repoStore.openFilePath : null;
    const label = viewLabel({
      shownView,
      tabPath,
      markdownMode: tabPath ? (fileCommands.states[tabPath]?.markdownMode ?? null) : null,
      leftPanel: settings.leftPanel,
      bottomPanel: terminalStore.panelOpen ? terminalStore.panelTab : null,
    });
    if (label !== lastViewLabel) {
      lastViewLabel = label;
      untrack(() => logMemoryEvent(label));
    }
  });

  // Open editors follow the Render whitespace setting without being rebuilt.
  $effect(() => {
    setRenderWhitespace(settings.renderWhitespace);
  });

  // And the cursor settings.
  $effect(() => {
    setEditorCursor(cursorOptions(settings));
  });

  // And word wrap (View > Word Wrap, Option+Z).
  $effect(() => {
    setWordWrap(settings.wordWrap);
  });

  // And the editor features (auto-close, completion, folding, guides...); a feature turned off leaves the editors.
  $effect(() => {
    setEditorFeatures(featureOptions(settings));
  });

  onMount(() => {
    settings.applyTheme();
    // Shells left running by a reload of the window would otherwise leak.
    terminalStore.init();
    void start();
    // Non-passive so the page itself does not zoom or scroll while resizing text.
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      clearTimeout(zoomBadgeTimer);
    };
  });

  function onWheel(event: WheelEvent): void {
    if (!settings.mouseWheelZoom || !(event.ctrlKey || event.metaKey)) {
      return;
    }
    if (!(event.target as HTMLElement | null)?.closest(".cm-editor")) {
      return;
    }
    event.preventDefault();
    const next = wheelZoom.apply(settings.editorFontSize, event.deltaY, event.deltaMode);
    if (next !== settings.editorFontSize) {
      settings.setPreference("editorFontSize", next);
    }
    zoomBadge = next;
    clearTimeout(zoomBadgeTimer);
    zoomBadgeTimer = setTimeout(() => {
      zoomBadge = null;
      wheelZoom.reset();
    }, 900);
  }

  async function start(): Promise<void> {
    // Recent folders and preferences come from ~/.gitmanager.
    await settings.init();
    settingsLoaded = true;
    void updates.init();
    try {
      launch = await api.getLaunchMode();
    } catch (error) {
      toast.error("Could not start", errorMessage(error));
      launch = { mode: "app", repoPath: null };
      void appMenu.install("app");
      return;
    }
    void appMenu.install(launch.mode === "mergeTool" ? "mergeTool" : "app");
    if (launch.mode === "app") {
      if (launch.repoPath && isWorkspaceFile(launch.repoPath)) {
        await repoStore.openWorkspaceFile(launch.repoPath);
      } else if (launch.repoPath) {
        await repoStore.open(launch.repoPath);
      } else {
        await restoreSession();
      }
    }
  }

  /** Reopens what was open at quit, like VS Code; nothing after an explicit Close Folder. */
  async function restoreSession(): Promise<void> {
    for (const step of sessionSteps(settings)) {
      const opened =
        step.kind === "workspaceFile"
          ? await repoStore.openWorkspaceFile(step.filePath)
          : await repoStore.openFolders(step.folderPaths);
      if (opened) {
        return;
      }
    }
  }
</script>

{#if launch?.mode === "mergeTool"}
  <MergeToolApp />
{:else if launch && repoStore.workspace}
  <Workspace />
{:else if launch}
  <Welcome />
{/if}

{#if settings.dialogOpen}
  <SettingsDialog />
{/if}

{#if updates.dialogOpen}
  <UpdateDialog />
{/if}

{#if updates.whatsNewOpen}
  <WhatsNewDialog />
{/if}

{#if helpDialogs.shortcutsOpen}
  {#await import("$lib/help/ShortcutsDialog.svelte") then module}
    <module.default />
  {/await}
{/if}

{#if mcpStore.toolsDialogOpen}
  {#await import("$lib/mcp/McpToolsDialog.svelte") then module}
    <module.default />
  {/await}
{/if}

<svelte:window
  onkeydown={(event) => {
    // Cmd+, opens Settings, as in every macOS app. The page sees the key before the menu's
    // Settings item, and preventing it here keeps that item from opening it again.
    if ((event.metaKey || event.ctrlKey) && event.key === ",") {
      event.preventDefault();
      settings.openDialog();
    }
  }}
/>

{#if zoomBadge !== null}
  <div class="zoom-badge" role="status">Editor font size {zoomBadge}px</div>
{/if}

<OpeningProgress />
<Toasts />
{#if launch?.mode !== "mergeTool"}
  <GitDialogHost />
{/if}
<DialogHost />
<ContextMenuHost />

<style>
  .zoom-badge {
    position: fixed;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1100;
    padding: 6px 14px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow);
    font-size: 12.5px;
    font-weight: 500;
    pointer-events: none;
  }
</style>
