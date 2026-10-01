<!-- Bottom status bar: repository state on the left, app memory on the right. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api";
  import { isCommitTab, parseCommitTabPath } from "$lib/stores/commitTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { MemoryUsage } from "$lib/types";
  import { editorStatus } from "$lib/stores/editorStatus.svelte";
  import { locateAbsolute } from "$lib/stores/workspacePaths";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { updates } from "$lib/update/updates.svelte";

  const POLL_MS = 5000;

  let memory = $state.raw<MemoryUsage | null>(null);
  let detailsOpen = $state(false);
  let memoryEl = $state<HTMLDivElement | null>(null);

  // Like VS Code, the left side follows what is on screen: the repository of
  // the visible file tab or diff, else the active repository.
  const shownView = $derived(changesSelection.shownView);
  const contextRepo = $derived.by(() => {
    if (shownView === "file" && repoStore.openFilePath) {
      const commit = parseCommitTabPath(repoStore.openFilePath);
      if (commit) {
        return repoStore.repos.find((repo) => repo.root === commit.repoRoot) ?? null;
      }
      return locateAbsolute(repoStore.repos, repoStore.openFilePath)?.repo ?? null;
    }
    if (shownView === "diff" && changesSelection.selected) {
      const root = changesSelection.selected.repoRoot;
      return repoStore.repos.find((repo) => repo.root === root) ?? null;
    }
    return repoStore.repo;
  });
  const contextStatus = $derived(contextRepo ? (repoStore.statuses[contextRepo.root] ?? null) : null);
  const head = $derived(contextStatus?.head ?? null);
  const branch = $derived(head?.branch ?? (head?.shortId ? `detached ${head.shortId}` : null));
  const changes = $derived(contextStatus?.files.length ?? 0);
  const conflicts = $derived(contextStatus?.files.filter((file) => file.conflicted).length ?? 0);
  const op = $derived(contextStatus?.op ?? null);
  /** A file tab is on screen and outside every repository. */
  const fileWithoutRepo = $derived(
    shownView === "file" && repoStore.openFilePath !== null && !isCommitTab(repoStore.openFilePath) && contextRepo === null,
  );
  const fileInfo = $derived(
    shownView === "file" && editorStatus.info && editorStatus.info.filePath === repoStore.openFilePath ? editorStatus.info : null,
  );

  /** Clicking the repository or branch makes it active, then shows branches. */
  async function showBranches(): Promise<void> {
    if (contextRepo && contextRepo.root !== repoStore.repo?.root) {
      await repoStore.setActiveRepo(contextRepo.root);
    }
    settings.setLeftPanel("branches");
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

  function toggleDetails(): void {
    detailsOpen = !detailsOpen;
    if (detailsOpen) {
      void poll();
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
        onclick={() => void showBranches()}
        title="Repository {contextRepo.root}{contextRepo.root === repoStore.repo?.root ? ' (active)' : '. Click to make it active'}"
      >
        <Icon name="folder-git" size={12} />
        <span>{contextRepo.name}</span>
      </button>
      {#if branch}
        <button class="item" onclick={() => void showBranches()} title="Branch {branch} of {contextRepo.name}">
          <Icon name="branch" size={12} />
          <span>{branch}</span>
          {#if head && (head.ahead > 0 || head.behind > 0)}
            <span class="sync">
              {#if head.behind > 0}{head.behind}<Icon name="arrow-down" size={10} />{/if}
              {#if head.ahead > 0}{head.ahead}<Icon name="arrow-up" size={10} />{/if}
            </span>
          {/if}
        </button>
      {/if}
      {#if changes > 0}
        <button class="item" onclick={() => settings.setLeftPanel("changes")} title="Changed files in {contextRepo.name}">
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
      <span class="item static" title="This file is not inside a git repository"><Icon name="folder" size={12} /> No repository</span>
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
      <button class="item" onclick={() => settings.openDialog("editor")} title="Indentation (change in Settings > Editor)">
        Spaces: {fileInfo.tabSize}
      </button>
      <span class="item static" title="Line endings">{fileInfo.eol === "crlf" ? "CRLF" : "LF"}</span>
      <span class="item static" title="Language">{fileInfo.language}</span>
      <span class="gap"></span>
    {/if}
    {#if updates.available}
      <button class="item update" onclick={() => (updates.dialogOpen = true)} title="See what's new and download">
        <Icon name="arrow-down" size={12} />
        <span>Update available: {updates.available.version}{updates.available.prerelease ? " (beta)" : ""}</span>
      </button>
    {/if}
    {#if repoStore.busy}
      <span class="item static busy"><span class="spinner"></span>{repoStore.busy}...</span>
    {/if}
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
            <p class="note">
              Physical memory, as Activity Monitor shows it. The UI runs in macOS WebKit helper processes, which are counted too.
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

  button.item:hover,
  .item.open {
    background: var(--hover);
    color: var(--text);
  }

  .item.static {
    cursor: default;
  }

  .item.icon-only {
    padding: 0 5px;
  }

  .item.update {
    color: var(--accent);
    font-weight: 600;
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

  .sync {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    margin-left: 2px;
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
