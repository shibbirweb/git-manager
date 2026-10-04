<!-- Git > Show Reflog: where HEAD (or a branch) pointed before, newest first, paged and
     virtualized, with the selected entry's commit below and actions to go back to it. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import CommitDetails from "$lib/log/CommitDetails.svelte";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ReflogEntry } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { newBranchFrom, repoTarget } from "../sidebar/actions";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { hasCommit, reflogActionLabel, visibleRange } from "./reflogView";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  const PAGE_SIZE = 300;
  const ROW_HEIGHT = 26;
  const OVERSCAN = 10;

  let refName = $state("HEAD");
  let branches = $state.raw<string[]>([]);
  let entries = $state.raw<ReflogEntry[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let selectedIndex = $state<number | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let listEl = $state<HTMLDivElement | null>(null);
  let token = 0;
  const now = Date.now();

  const selected = $derived(selectedIndex !== null ? (entries[selectedIndex] ?? null) : null);
  const range = $derived(visibleRange(scrollTop, viewportHeight, ROW_HEIGHT, entries.length, OVERSCAN));
  const visible = $derived(entries.slice(range.start, range.end));
  const hasMore = $derived(entries.length < total);
  const busy = $derived(repoStore.busy !== null);
  // HEAD or a branch moved: the reflog has a new entry.
  const headVersion = $derived(repoRoot === repoStore.repo?.root ? repoStore.historyVersion : 0);

  $effect(() => {
    void repoRoot;
    void refName;
    void headVersion;
    untrack(() => void reload());
  });

  $effect(() => {
    void repoRoot;
    untrack(() => void loadBranches());
  });

  async function loadBranches(): Promise<void> {
    const refs = repoRoot === repoStore.repo?.root ? repoStore.refs : await api.getRefs(repoRoot).catch(() => null);
    branches = refs?.local.map((branch) => branch.name) ?? [];
  }

  async function reload(): Promise<void> {
    const current = ++token;
    loading = true;
    loadError = null;
    try {
      const page = await api.getReflog(repoRoot, refName === "HEAD" ? null : refName, 0, PAGE_SIZE);
      if (current !== token) {
        return;
      }
      entries = page.entries;
      total = page.total;
      selectedIndex = page.entries.length > 0 ? 0 : null;
    } catch (error) {
      if (current === token) {
        entries = [];
        total = 0;
        loadError = errorMessage(error);
      }
    } finally {
      if (current === token) {
        loading = false;
      }
    }
  }

  async function loadMore(): Promise<void> {
    if (loading || !hasMore) {
      return;
    }
    const current = token;
    loading = true;
    try {
      const page = await api.getReflog(repoRoot, refName === "HEAD" ? null : refName, entries.length, PAGE_SIZE);
      if (current === token) {
        entries = [...entries, ...page.entries];
        total = page.entries.length === 0 ? entries.length : page.total;
      }
    } catch (error) {
      if (current === token) {
        toast.error("Could not load more of the reflog", errorMessage(error));
        total = entries.length;
      }
    } finally {
      if (current === token) {
        loading = false;
      }
    }
  }

  function onScroll(event: Event): void {
    const element = event.currentTarget as HTMLElement;
    scrollTop = element.scrollTop;
    if (element.scrollTop + element.clientHeight > element.scrollHeight - ROW_HEIGHT * 20) {
      void loadMore();
    }
  }

  function select(index: number): void {
    if (entries.length === 0) {
      return;
    }
    const next = Math.max(0, Math.min(entries.length - 1, index));
    selectedIndex = next;
    if (listEl) {
      const top = next * ROW_HEIGHT;
      if (top < listEl.scrollTop) {
        listEl.scrollTop = top;
      } else if (top + ROW_HEIGHT > listEl.scrollTop + listEl.clientHeight) {
        listEl.scrollTop = top + ROW_HEIGHT - listEl.clientHeight;
      }
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      select((selectedIndex ?? -1) + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      showCommit(selected);
    }
  }

  function showCommit(entry: ReflogEntry): void {
    if (hasCommit(entry)) {
      repoStore.openCommitTab(repoRoot, entry.newId, { summary: entry.detail || null });
    }
  }

  async function checkout(entry: ReflogEntry): Promise<void> {
    const confirmed = await dialogs.confirm({
      title: "Checkout Revision",
      message: `Check out ${entry.newShortId} (${entry.selector}) in detached HEAD state? New commits there will not belong to any branch until you create one.`,
      confirmLabel: "Checkout",
    });
    if (!confirmed) {
      return;
    }
    await repoStore.run("Checkout", (repoPath) => api.checkoutCommit(repoPath, entry.newId), {
      repoPath: repoRoot,
      success: `HEAD is now at ${entry.newShortId}`,
    });
  }

  function resetHere(entry: ReflogEntry): void {
    gitDialogs.open({ kind: "reset", repoRoot, revision: entry.newId });
  }

  async function copyHash(entry: ReflogEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.newId);
      toast.success("Copied revision hash", entry.newId);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function openMenu(event: MouseEvent, index: number): void {
    const entry = entries[index];
    if (!entry) {
      return;
    }
    selectedIndex = index;
    const commit = hasCommit(entry);
    const operation = (repoStore.statuses[repoRoot]?.op.kind ?? "none") !== "none";
    const items: MenuItem[] = [
      { label: "Show Commit", hint: "Enter", disabled: !commit, action: () => showCommit(entry) },
      { label: "Copy Revision Hash", disabled: !commit, action: () => void copyHash(entry) },
      { separator: true },
      { label: "New Branch Here...", disabled: !commit || busy, action: () => void newBranchFrom(entry.newId, "", repoTarget(repoRoot, repoStore.refs)) },
      { label: "Checkout Revision", disabled: !commit || busy, action: () => void checkout(entry) },
      { separator: true },
      { label: "Reset Current Branch to Here...", disabled: !commit || busy || operation, action: () => resetHere(entry) },
    ];
    contextMenu.open(event, items);
  }

  function loadedShortId(commitId: string): string | null {
    return entries.find((entry) => entry.newId === commitId)?.newShortId ?? null;
  }
</script>

<div class="reflog-tab">
  <div class="toolbar">
    <Icon name="history" size={14} />
    <span class="title">Reflog of</span>
    <select class="input ref-select" bind:value={refName} aria-label="Reference">
      <option value="HEAD">HEAD</option>
      {#each branches as branchName (branchName)}
        <option value={branchName}>{branchName}</option>
      {/each}
    </select>
    <span class="spacer"></span>
    {#if loading}
      <span class="spinner" aria-hidden="true"></span>
    {/if}
    <span class="count dim">{total} {total === 1 ? "entry" : "entries"}</span>
    <button class="icon-btn" onclick={() => void reload()} disabled={loading} title="Refresh">
      <Icon name="refresh" size={14} />
    </button>
  </div>
  {#if loadError}
    <div class="placeholder">
      <div>Could not read the reflog</div>
      <div class="dim selectable">{loadError}</div>
    </div>
  {:else}
    <div
      class="list"
      bind:this={listEl}
      bind:clientHeight={viewportHeight}
      role="listbox"
      tabindex="0"
      aria-label="Reflog entries"
      onscroll={onScroll}
      onkeydown={onKeydown}
    >
      <div class="spacer-rows" style="height: {entries.length * ROW_HEIGHT}px">
        {#each visible as entry, offset (entry.index)}
          {@const index = range.start + offset}
          <div
            class="entry"
            class:selected={index === selectedIndex}
            role="option"
            aria-selected={index === selectedIndex}
            tabindex="-1"
            style="transform: translateY({index * ROW_HEIGHT}px); height: {ROW_HEIGHT}px"
            onmousedown={() => (selectedIndex = index)}
            ondblclick={() => showCommit(entry)}
            oncontextmenu={(event) => openMenu(event, index)}
          >
            <span class="selector mono">{entry.selector}</span>
            <span class="hash mono">{entry.newShortId}</span>
            <span class="action action-{entry.action}">{reflogActionLabel(entry.action)}</span>
            <span class="detail truncate" title={entry.message}>{entry.detail || entry.message}</span>
            <span class="when dim" title={fullDate(entry.time)}>{relativeTime(entry.time, now)}</span>
          </div>
        {/each}
      </div>
      {#if entries.length === 0 && !loading}
        <div class="placeholder dim">This reference has no reflog entries.</div>
      {/if}
    </div>
    <div class="details">
      {#if selected && hasCommit(selected)}
        {#key selected.newId}
          <CommitDetails
            repoPath={repoRoot}
            commitId={selected.newId}
            {loadedShortId}
            onSelectCommit={(commitId) => repoStore.openCommitTab(repoRoot, commitId)}
            onOpenInTab={(path) => repoStore.openCommitTab(repoRoot, selected.newId, { filePath: path })}
          />
        {/key}
      {/if}
    </div>
  {/if}
</div>

<style>
  .reflog-tab {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--panel);
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border-strong);
  }

  .ref-select {
    max-width: 260px;
    height: 24px;
  }

  .spacer {
    flex: 1;
  }

  .count {
    font-size: 12px;
  }

  .list {
    position: relative;
    flex: 0 0 42%;
    min-height: 80px;
    overflow-y: auto;
    outline: none;
    border-bottom: 1px solid var(--border-strong);
  }

  .spacer-rows {
    position: relative;
  }

  .entry {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    cursor: default;
  }

  .entry:hover {
    background: var(--hover);
  }

  .entry.selected {
    background: var(--selected-inactive);
  }

  .list:focus .entry.selected {
    background: var(--selected);
  }

  .selector {
    flex: none;
    width: 90px;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .hash {
    flex: none;
    width: 70px;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .action {
    --action-color: var(--text-dim);
    flex: none;
    width: 84px;
    font-size: 11.5px;
    color: color-mix(in srgb, var(--action-color) 85%, var(--text));
  }

  .action-commit,
  .action-initialCommit,
  .action-amend {
    --action-color: var(--success);
  }

  .action-reset,
  .action-rebase {
    --action-color: var(--danger);
  }

  .action-checkout {
    --action-color: var(--accent);
  }

  .action-merge,
  .action-pull,
  .action-cherryPick,
  .action-revert {
    --action-color: var(--warning);
  }

  .detail {
    flex: 1;
    min-width: 0;
  }

  .when {
    flex: none;
    width: 90px;
    text-align: right;
    font-size: 12px;
  }

  .details {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .placeholder {
    padding: 24px;
    text-align: center;
  }

  .spinner {
    flex: none;
    width: 12px;
    height: 12px;
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
</style>
