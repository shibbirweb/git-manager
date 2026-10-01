<script lang="ts">
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { WheelZoom } from "$lib/editor/wheelZoom";
  import MergeToolApp from "$lib/merge/MergeToolApp.svelte";
  import { isWorkspaceFile, repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { sessionSteps } from "$lib/stores/settingsData";
  import type { LaunchMode } from "$lib/types";
  import ContextMenuHost from "$lib/ui/ContextMenuHost.svelte";
  import DialogHost from "$lib/ui/DialogHost.svelte";
  import Toasts from "$lib/ui/Toasts.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import SettingsDialog from "$lib/views/SettingsDialog.svelte";
  import UpdateDialog from "$lib/update/UpdateDialog.svelte";
  import { updates } from "$lib/update/updates.svelte";
  import WhatsNewDialog from "$lib/update/WhatsNewDialog.svelte";
  import Welcome from "$lib/views/Welcome.svelte";
  import Workspace from "$lib/views/Workspace.svelte";

  let launch = $state<LaunchMode | null>(null);
  /** Font size badge shown briefly while zooming with the mouse wheel. */
  let zoomBadge = $state<number | null>(null);
  let zoomBadgeTimer: ReturnType<typeof setTimeout> | undefined;
  const wheelZoom = new WheelZoom();

  onMount(() => {
    settings.applyTheme();
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
    void updates.init();
    try {
      launch = await api.getLaunchMode();
    } catch (error) {
      toast.error("Could not start", errorMessage(error));
      launch = { mode: "app", repoPath: null };
      return;
    }
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

<svelte:window
  onkeydown={(event) => {
    // Cmd+, opens Settings, as in every macOS app.
    if ((event.metaKey || event.ctrlKey) && event.key === ",") {
      event.preventDefault();
      settings.openDialog();
    }
  }}
/>

{#if zoomBadge !== null}
  <div class="zoom-badge" role="status">Editor font size {zoomBadge}px</div>
{/if}

<Toasts />
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
