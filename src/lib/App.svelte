<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { api, currentWindowLabel, errorMessage } from "$lib/api";
  import { viewLabel, watchScrolling } from "$lib/debug/memoryEvents";
  import { helpDialogs } from "$lib/help/helpDialogs.svelte";
  import { memoryLog } from "$lib/debug/memoryLog.svelte";
  import { WheelZoom } from "$lib/editor/wheelZoom";
  import { cursorOptions, setEditorCursor } from "$lib/editor/cursor";
  import { featureOptions } from "$lib/editor/featurePlan";
  import { setEditorFeatures } from "$lib/editor/features";
  import { setCommandKeys } from "$lib/editor/commandKeys";
  import { editorKeyPlan } from "$lib/commands/editorKeyPlan";
  import { runCommand, usesDefaultKeys, windowKeys } from "$lib/commands/commandRuntime";
  import { setRenderWhitespace } from "$lib/editor/whitespace";
  import { setWordWrap } from "$lib/editor/wordWrap";
  import { setIndentation } from "$lib/editor/indentation";
  import { appMenu } from "$lib/menu/appMenu.svelte";
  import { quickOpen } from "$lib/quickOpen/quickOpenStore.svelte";
  import { startMcpBridge } from "$lib/mcp/bridge";
  import { mcpStore } from "$lib/mcp/mcpStore.svelte";
  import { localHistory } from "$lib/localHistory/localHistory.svelte";
  import { notifications } from "$lib/notifications/notifications.svelte";
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
  import { guardWindowClose } from "$lib/windows/windowActions";
  import { MAIN_WINDOW, parseWindowStart, startStep, windowTitle } from "$lib/windows/windowSession";

  let launch = $state<LaunchMode | null>(null);
  /** Font size badge shown briefly while zooming with the mouse wheel. */
  let zoomBadge = $state<number | null>(null);
  let zoomBadgeTimer: ReturnType<typeof setTimeout> | undefined;
  const wheelZoom = new WheelZoom();
  let settingsLoaded = $state(false);
  /** The page asked what its window should show: from then on it reports what it shows. */
  let windowReady = $state(false);

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

  // The MCP server and the command line tool run while either switch is on. App windows drive
  // them (the backend keeps a running server when a window repeats the same settings); a git
  // mergetool window would compete for the same port.
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

  // Tools and the image and PDF previews only reach the folders open now; the backend also
  // keeps them for the window's title, its events and the window session.
  const workspaceFolderKey = $derived((repoStore.workspace?.folders ?? []).map((folder) => folder.root).join("\n"));
  const workspaceFile = $derived(repoStore.workspace?.file ?? null);
  const workspaceTitle = $derived(windowTitle(repoStore.workspace?.name ?? null));
  $effect(() => {
    if (!mainWindow || !windowReady) {
      return;
    }
    const folderPaths = workspaceFolderKey ? workspaceFolderKey.split("\n") : [];
    syncWorkspaceFolders(folderPaths, workspaceFile, workspaceTitle);
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

  // Local History (Settings > Editor): the backend keeps versions only while it is on.
  $effect(() => {
    if (!mainWindow) {
      return;
    }
    const enabled = settings.localHistoryEnabled;
    const days = settings.localHistoryDays;
    const sizeMb = settings.localHistorySizeMb;
    untrack(() => localHistory.configure(enabled, days, sizeMb));
  });

  // Do Not Disturb keeps non-error toasts in the bell's list only.
  $effect(() => {
    notifications.doNotDisturb = settings.notificationsDoNotDisturb;
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

  // And the indentation: each open editor reads its file again with the new settings.
  $effect(() => {
    setIndentation({ detect: settings.detectIndentation, tabSize: settings.tabSize });
  });

  // And the editor features (auto-close, completion, folding, guides...); a feature turned off leaves the editors.
  $effect(() => {
    setEditorFeatures(featureOptions(settings));
  });

  // And the custom keyboard shortcuts; a window command with a custom key also runs from an editor.
  $effect(() => {
    const keys = windowKeys();
    untrack(() => setCommandKeys(editorKeyPlan(keys.specs, keys.overrides, keys.platform), runCommand));
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
    // One window checks for updates and shows What's New, not every window at once.
    if (currentWindowLabel() === MAIN_WINDOW) {
      void updates.init();
    }
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
      // Closing a window asks about unsaved edits first (git mergetool has its own question).
      void guardWindowClose();
      await openForWindow(launch.repoPath);
    }
  }

  /**
   * What this window opens: its own folders (a restored window, Open Folder in New Window, or a
   * reload), the welcome screen for New Window, else the command line or the last session.
   */
  async function openForWindow(launchPath: string | null): Promise<void> {
    const start = parseWindowStart(await api.windowStartup().catch(() => null));
    const step = startStep(start, launchPath);
    // Asked first: what the window reports from now on is what a reload reopens.
    windowReady = true;
    if (step.kind === "workspaceFile") {
      await repoStore.openWorkspaceFile(step.filePath, { focusExisting: false });
    } else if (step.kind === "folders") {
      await repoStore.openFolders(step.folderPaths, null, { focusExisting: false });
    } else if (step.kind === "launch" && isWorkspaceFile(step.path)) {
      await repoStore.openWorkspaceFile(step.path);
    } else if (step.kind === "launch") {
      await repoStore.open(step.path);
    } else if (step.kind === "session") {
      await restoreSession();
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

<!-- Quick Open and the Command Palette (Cmd+P, Shift+Cmd+P); also on the welcome screen. -->
{#if quickOpen.isOpen && launch?.mode === "app"}
  {#await import("$lib/quickOpen/QuickOpen.svelte") then module}
    <module.default />
  {/await}
{/if}

{#if localHistory.target && launch?.mode === "app"}
  {#await import("$lib/localHistory/LocalHistoryDialog.svelte") then module}
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
    // Settings item, and preventing it here keeps that item from opening it again. A custom
    // key for Settings goes through the window shortcuts and the menu instead.
    if ((event.metaKey || event.ctrlKey) && event.key === "," && !event.defaultPrevented && usesDefaultKeys("app.settings")) {
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
