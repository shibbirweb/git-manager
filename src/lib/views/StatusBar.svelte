<!-- Bottom status bar: repository state on the left, app memory on the right. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { openBranchPicker, syncFromRow } from "./changes/repoActions";
  import { rowSync, rowSyncBadge, rowSyncTooltip } from "./changes/sync";
  import { gpuRenderers } from "$lib/terminal/gpuRenderers.svelte";
  import { terminalDrawingSummary, type WebglInfo, webglLabel } from "$lib/terminal/gpuStatus";
  import { probeWebgl } from "$lib/ui/webglProbe";
  import { api } from "$lib/api";
  import { branchTabPath } from "$lib/stores/branchTabs";
  import { loadingChangesText } from "$lib/stores/openingProgress";
  import { autoFetch } from "$lib/stores/autoFetch.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { MemoryUsage } from "$lib/types";
  import { editorStatus } from "$lib/stores/editorStatus.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import NotificationBell from "$lib/notifications/NotificationBell.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { currentScreenRepo, openRepoPicker } from "./repoSelection.svelte";
  import { updates } from "$lib/update/updates.svelte";

  const POLL_MS = 5000;

  let memory = $state.raw<MemoryUsage | null>(null);
  let detailsOpen = $state(false);
  let memoryEl = $state<HTMLDivElement | null>(null);

  // The left side describes the active repository. With Auto (the
  // default) that follows the open tab, and a file outside every repository says so.
  const shownView = $derived(changesSelection.shownView);
  const screen = $derived(currentScreenRepo());
  const contextRepo = $derived.by(() => {
    if (settings.activeRepoAuto && screen.kind === "repo") {
      return repoStore.repos.find((repo) => repo.root === screen.repoRoot) ?? null;
    }
    if (settings.activeRepoAuto && screen.kind === "outside") {
      return null;
    }
    return repoStore.repo;
  });
  const contextStatus = $derived(contextRepo ? (repoStore.statuses[contextRepo.root] ?? null) : null);
  const head = $derived(contextStatus?.head ?? null);
  const branch = $derived(head?.branch ?? (head?.shortId ? `detached ${head.shortId}` : null));
  const changes = $derived(contextStatus?.files.length ?? 0);
  const conflicts = $derived(contextStatus?.files.filter((file) => file.conflicted).length ?? 0);
  const op = $derived(contextStatus?.op ?? null);
  // The Synchronize Changes item: sync with the upstream, or publish a branch without one.
  const sync = $derived(rowSync(head));
  const syncBadge = $derived(rowSyncBadge(sync));
  let syncing = $state(false);
  /** A file tab is on screen and outside every repository. */
  const fileWithoutRepo = $derived(settings.activeRepoAuto && screen.kind === "outside");
  const fileInfo = $derived(
    shownView === "file" && editorStatus.info && editorStatus.info.filePath === repoStore.openFilePath ? editorStatus.info : null,
  );

  async function runSync(repoRoot: string): Promise<void> {
    syncing = true;
    try {
      await syncFromRow(repoRoot);
    } finally {
      syncing = false;
    }
  }

  async function showConflicts(): Promise<void> {
    await repoStore.openConflicts(contextRepo?.root);
  }

  function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  }

  async function poll(): Promise<void> {
    try {
      memory = await api.memoryUsage();
    } catch {
      memory = null;
    }
  }

  onMount(() => {
    void poll();
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => void poll(), POLL_MS);
    };
    // Measuring costs a little CPU; skip it while the window is hidden.
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        void poll();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  });

  /** Bug report or feature request, opened above the button. */
  function openFeedbackMenu(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    contextMenu.open(new MouseEvent("contextmenu", { clientX: rect.right - 200, clientY: rect.top - 76 }), [
      { label: "Report a Bug", hint: "GitHub issue", action: () => void updates.reportBug() },
      { label: "Request a Feature", hint: "GitHub issue", action: () => void updates.requestFeature() },
    ]);
  }

  /** Checked each time the popup opens; the test context is released at once. */
  let webgl = $state<WebglInfo | null>(null);
  const terminalDrawing = $derived(
    terminalDrawingSummary({
      drawings: [...gpuRenderers.drawings.values()],
      gpuSetting: settings.terminalGpuAcceleration,
      ligatures: settings.terminalLigatures,
    }),
  );

  function toggleDetails(): void {
    detailsOpen = !detailsOpen;
    if (detailsOpen) {
      void poll();
      webgl = probeWebgl();
    }
  }
</script>

<svelte:window
  onmousedown={(event) => {
    if (detailsOpen && memoryEl && !memoryEl.contains(event.target as Node)) {
      detailsOpen = false;
    }
  }}
  onkeydown={(event) => {
    if (event.key === "Escape" && detailsOpen) {
      detailsOpen = false;
    }
  }}
/>

<footer class="status-bar">
  <div class="left">
    {#if contextRepo}
      <button
        class="item"
        onclick={() => void openRepoPicker()}
        title="Repository {contextRepo.root}{settings.activeRepoAuto ? ' (Auto)' : ''}. Click to select a repository."
      >
        <Icon name="folder-git" size={12} />
        <span>{contextRepo.name}</span>
      </button>
      {#if branch}
        <button
          class="item branch"
          onclick={() => openBranchPicker(contextRepo.root)}
          title="Branch {branch} of {contextRepo.name}. Click to check out another branch."
        >
          <Icon name="branch" size={12} />
          <span class="branch-name">{branch}</span>
        </button>
      {/if}
      {#if sync.kind !== "hidden"}
        <button
          class="item"
          class:spinning={syncing}
          onclick={() => void runSync(contextRepo.root)}
          disabled={repoStore.busy !== null || (op?.kind ?? "none") !== "none"}
          title={rowSyncTooltip(sync)}
          aria-label={sync.kind === "publish" ? "Publish Branch" : "Synchronize Changes"}
        >
          <Icon name={sync.kind === "publish" ? "cloud-upload" : "sync"} size={12} />
          {#if syncBadge}
            <span>{syncBadge}</span>
          {/if}
        </button>
      {/if}
      {#if changes > 0}
        <button
          class="item"
          onclick={() => repoStore.openPseudoTab(branchTabPath({ kind: "changes", repoRoot: contextRepo.root }))}
          title="Changed files in {contextRepo.name}. Click to see them in a tab."
        >
          <Icon name="git-compare" size={12} />
          <span>{changes} {changes === 1 ? "change" : "changes"}</span>
        </button>
      {/if}
      {#if conflicts > 0}
        <button class="item conflict" onclick={() => void showConflicts()} title="Resolve conflicts in {contextRepo.name}">
          <Icon name="alert" size={12} />
          <span>{conflicts} {conflicts === 1 ? "conflict" : "conflicts"}</span>
        </button>
      {/if}
      {#if op && op.kind !== "none"}
        <span class="item static op">{op.description}</span>
      {/if}
    {:else if fileWithoutRepo}
      {#if repoStore.repos.length > 0}
        <button class="item" onclick={() => void openRepoPicker()} title="This file is not inside a git repository. Click to select a repository.">
          <Icon name="folder" size={12} /> No repository
        </button>
      {:else}
        <span class="item static" title="This file is not inside a git repository"><Icon name="folder" size={12} /> No repository</span>
      {/if}
    {:else if repoStore.workspace}
      <span class="item static"><Icon name="folder" size={12} /> {repoStore.workspace.name}</span>
    {/if}
  </div>

  <div class="right">
    {#if fileInfo}
      <span class="item static" title="Cursor position">
        Ln {fileInfo.line}, Col {fileInfo.column}
        {#if fileInfo.selected > 0}
          ({fileInfo.selected} selected{fileInfo.selectedLines > 1 ? `, ${fileInfo.selectedLines} lines` : ""})
        {/if}
      </span>
      <button
        class="item"
        onclick={() => settings.openDialog("editor")}
        title={fileInfo.indentDetected ? "Indentation detected from the file (Settings > Editor)" : "Indentation (change in Settings > Editor)"}
      >
        {fileInfo.indentTabs ? "Tab Size" : "Spaces"}: {fileInfo.tabSize}
      </button>
      <span class="item static" title="Line endings">{fileInfo.eol === "crlf" ? "CRLF" : "LF"}</span>
      <span class="item static" title="Language">{fileInfo.language}</span>
      <span class="gap"></span>
    {/if}
    {#if autoFetch.hint}
      <button class="item fetch-hint" onclick={() => autoFetch.retryNow()} title={autoFetch.hint.title}>
        <Icon name="cloud" size={12} />
        <span>{autoFetch.hint.text}</span>
      </button>
    {/if}
    {#if updates.available}
      <button class="item update" onclick={() => (updates.dialogOpen = true)} title="See what's new and download">
        <Icon name="arrow-down" size={12} />
        <span>Update available: {updates.available.version}{updates.available.prerelease ? " (beta)" : ""}</span>
      </button>
    {/if}
    {#if repoStore.busy}
      <span class="item static busy"><span class="spinner"></span>{repoStore.busy}...</span>
    {:else if repoStore.loadingChanges}
      <span class="item static busy" title="Reading the changes of each repository; you can already work">
        <span class="spinner"></span>{loadingChangesText(repoStore.loadingChanges.done, repoStore.loadingChanges.total)}
      </span>
    {/if}
    <NotificationBell />
    <button class="item icon-only" onclick={() => void updates.openRepository()} title="Star Git Manager on GitHub" aria-label="Star on GitHub">
      <Icon name="star" size={12} />
    </button>
    <button class="item icon-only" onclick={openFeedbackMenu} title="Report a bug or request a feature" aria-label="Report an issue">
      <Icon name="bug" size={12} />
    </button>
    {#if memory && memory.totalBytes > 0}
      <div class="memory" bind:this={memoryEl}>
        <button
          class="item"
          class:open={detailsOpen}
          onclick={toggleDetails}
          title="Memory used by Git Manager and its web view processes. Click for details."
        >
          <span class="chip"></span>
          <span>Memory {formatBytes(memory.totalBytes)}</span>
        </button>
        {#if detailsOpen}
          <div class="details" role="dialog" aria-label="Memory usage">
            <div class="details-head">
              <span>Memory</span>
              <strong>{formatBytes(memory.totalBytes)}</strong>
            </div>
            {#each memory.processes as process (process.pid)}
              <div class="process" title="{process.name} (pid {process.pid})">
                <div class="process-row">
                  <span>{process.label}</span>
                  <span class="mono">{formatBytes(process.bytes)}</span>
                </div>
                <div class="bar">
                  <div class="fill" style="width: {Math.max(2, (process.bytes / memory.totalBytes) * 100)}%"></div>
                </div>
              </div>
            {/each}
            <div class="gpu" aria-label="GPU acceleration">
              <div class="gpu-title">GPU acceleration</div>
              <div class="process-row">
                <span>Terminals use the GPU</span>
                <span class="gpu-value" title={terminalDrawing}>{terminalDrawing}</span>
              </div>
              <div class="process-row">
                <span>WebGL support</span>
                <span class="gpu-value" title={webglLabel(webgl)}>{webglLabel(webgl)}</span>
              </div>
              <p class="gpu-note">
                The window always draws with the GPU through macOS (the Graphics process above). Only terminals add
                WebGL drawing, set in Settings, Terminal.
              </p>
            </div>
            <p class="note">
              Physical memory of the whole app, all windows together, as Activity Monitor shows it. The UI runs in macOS
              WebKit helper processes, one web content process per window, which are counted too.
              {#if memory.approximate}
                Started from a terminal, so helpers are matched by start time.
              {/if}
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</footer>

<style>
  .status-bar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 24px;
    padding: 0 6px;
    border-top: 1px solid var(--border-strong);
    background: var(--panel-alt);
    font-size: 12px;
    color: var(--text-dim);
  }

  /* Rounded panels: the status bar is part of the window frame. */
  :global(html[data-rounded-panels]) .status-bar {
    border-top: none;
    background: var(--frame);
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  .left {
    overflow: hidden;
  }

  .item {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 20px;
    padding: 0 7px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
  }

  button.item:hover:not(:disabled),
  .item.open {
    background: var(--hover);
    color: var(--text);
  }

  .item.static,
  button.item:disabled {
    cursor: default;
  }

  button.item:disabled:not(.spinning) {
    opacity: 0.6;
  }

  /* A long branch name shrinks first and never pushes the other items away. */
  .item.branch {
    flex: 0 1 auto;
    min-width: 0;
  }

  .branch-name {
    min-width: 0;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .spinning :global(svg) {
    animation: spin 0.8s linear infinite;
  }

  .item.icon-only {
    padding: 0 5px;
  }

  .item.update {
    color: var(--accent);
    font-weight: 600;
  }

  .item.fetch-hint {
    color: var(--warning);
  }

  .item.conflict {
    color: var(--danger);
  }

  .item.op {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gap {
    width: 6px;
  }

  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .memory {
    position: relative;
  }

  .chip {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--success);
  }

  .details {
    position: absolute;
    right: 0;
    bottom: 26px;
    z-index: 600;
    width: 300px;
    padding: 12px 14px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    color: var(--text);
  }

  .details-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .gpu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .gpu-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .gpu-note {
    margin: 0;
    font-size: 11px;
    color: var(--text-dim);
  }

  .gpu-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-dim);
  }

  .process {
    margin-bottom: 9px;
  }

  .process-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .bar {
    height: 4px;
    margin-top: 4px;
    border-radius: 2px;
    background: var(--hover);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: 2px;
    background: var(--accent);
  }

  .note {
    margin: 10px 0 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-dim);
  }
</style>
