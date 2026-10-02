<!-- Show History: the commits that changed one file (`git log --follow`, renames followed),
     newest first and paged, with the selected commit's details and that file's diff below. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import CommitDetails from "$lib/log/CommitDetails.svelte";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { gitTabPath } from "$lib/stores/gitTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { FileHistoryEntry } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";

  interface Props {
    repoRoot: string;
    filePath: string;
  }

  let { repoRoot, filePath }: Props = $props();

  const PAGE_SIZE = 200;

  let entries = $state.raw<FileHistoryEntry[]>([]);
  let hasMore = $state(true);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let token = 0;
  const now = Date.now();

  const selected = $derived(entries.find((entry) => entry.commit.id === selectedId) ?? null);
  // CommitDetails mounts again per commit, so one token is enough.
  const preferredFile = $derived(selected ? { commitId: selected.commit.id, path: selected.path, line: null, token: 1 } : null);

  $effect(() => {
    void repoRoot;
    void filePath;
    untrack(() => void reload());
  });

  async function reload(): Promise<void> {
    const current = ++token;
    loading = true;
    loadError = null;
    try {
      const page = await api.fileHistory(repoRoot, filePath, 0, PAGE_SIZE);
      if (current !== token) {
        return;
      }
      entries = page;
      hasMore = page.length >= PAGE_SIZE;
      selectedId = page[0]?.commit.id ?? null;
    } catch (error) {
      if (current === token) {
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
      const page = await api.fileHistory(repoRoot, filePath, entries.length, PAGE_SIZE);
      if (current === token) {
        entries = [...entries, ...page];
        hasMore = page.length >= PAGE_SIZE;
      }
    } catch (error) {
      if (current === token) {
        toast.error("Could not load more history", errorMessage(error));
        hasMore = false;
      }
    } finally {
      if (current === token) {
        loading = false;
      }
    }
  }

  function onScroll(event: Event): void {
    const element = event.currentTarget as HTMLElement;
    if (element.scrollTop + element.clientHeight > element.scrollHeight - 200) {
      void loadMore();
    }
  }

  function select(index: number): void {
    const entry = entries[Math.max(0, Math.min(entries.length - 1, index))];
    if (!entry) {
      return;
    }
    selectedId = entry.commit.id;
    requestAnimationFrame(() => {
      listEl?.querySelector(`[data-commit="${entry.commit.id}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }

  function onKeydown(event: KeyboardEvent): void {
    const index = entries.findIndex((entry) => entry.commit.id === selectedId);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      select(index + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      openCommit(selected);
    }
  }

  function loadedShortId(commitId: string): string | null {
    return entries.find((entry) => entry.commit.id === commitId)?.commit.shortId ?? null;
  }

  function onSelectCommit(commitId: string): void {
    if (entries.some((entry) => entry.commit.id === commitId)) {
      selectedId = commitId;
    } else {
      repoStore.openCommitTab(repoRoot, commitId);
    }
  }

  function openCommit(entry: FileHistoryEntry): void {
    repoStore.openCommitTab(repoRoot, entry.commit.id, { summary: entry.commit.summary, filePath: entry.path });
  }

  function compareWithWorkingCopy(entry: FileHistoryEntry): void {
    repoStore.openPseudoTab(gitTabPath({ kind: "compare", repoRoot, filePath, revision: entry.commit.id }));
  }

  async function copyHash(entry: FileHistoryEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.commit.id);
      toast.success("Copied revision hash", entry.commit.id);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function openMenu(event: MouseEvent, entry: FileHistoryEntry): void {
    selectedId = entry.commit.id;
    contextMenu.open(event, [
      { label: "Open Commit in Tab", hint: "Enter", action: () => openCommit(entry) },
      { label: "Compare with Working Copy", action: () => compareWithWorkingCopy(entry) },
      { label: "Show in Log", action: () => void repoStore.showCommit(repoRoot, entry.commit.id, entry.path) },
      { separator: true },
      { label: "Copy Revision Hash", action: () => void copyHash(entry) },
    ]);
  }
</script>

<div class="history-tab">
  <div class="toolbar">
    <Icon name="history" size={14} />
    <span class="title truncate">History of <span class="mono">{filePath}</span></span>
    <span class="spacer"></span>
    {#if loading}
      <span class="spinner" aria-hidden="true"></span>
    {/if}
    <span class="count dim">{entries.length}{hasMore ? "+" : ""} {entries.length === 1 ? "commit" : "commits"}</span>
    <button class="icon-btn" onclick={() => void reload()} disabled={loading} title="Refresh">
      <Icon name="refresh" size={14} />
    </button>
  </div>
  {#if loadError}
    <div class="placeholder">
      <div>Could not read the history</div>
      <div class="dim selectable">{loadError}</div>
    </div>
  {:else}
    <div class="list" bind:this={listEl} role="listbox" tabindex="0" aria-label="Commits" onscroll={onScroll} onkeydown={onKeydown}>
      {#each entries as entry (entry.commit.id)}
        <div
          class="entry"
          class:selected={entry.commit.id === selectedId}
          data-commit={entry.commit.id}
          role="option"
          aria-selected={entry.commit.id === selectedId}
          tabindex="-1"
          onmousedown={() => (selectedId = entry.commit.id)}
          ondblclick={() => openCommit(entry)}
          oncontextmenu={(event) => openMenu(event, entry)}
        >
          <span class="hash mono">{entry.commit.shortId}</span>
          <span class="subject truncate" title={entry.commit.summary}>{entry.commit.summary}</span>
          {#if entry.path !== filePath}
            <span class="renamed truncate" title="The file was {entry.path} in this commit">{entry.path}</span>
          {/if}
          <span class="author truncate dim">{entry.commit.authorName}</span>
          <span class="when dim" title={fullDate(entry.commit.time)}>{relativeTime(entry.commit.time, now)}</span>
        </div>
      {:else}
        {#if !loading}
          <div class="placeholder dim">No commits touch this file yet.</div>
        {/if}
      {/each}
    </div>
    <div class="details">
      {#if selected}
        {#key selected.commit.id}
          <CommitDetails
            repoPath={repoRoot}
            commitId={selected.commit.id}
            {loadedShortId}
            {onSelectCommit}
            {preferredFile}
            onOpenInTab={(path) => repoStore.openCommitTab(repoRoot, selected.commit.id, { summary: selected.commit.summary, filePath: path })}
          />
        {/key}
      {/if}
    </div>
  {/if}
</div>

<style>
  .history-tab {
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

  .title {
    min-width: 0;
  }

  .spacer {
    flex: 1;
  }

  .count {
    font-size: 12px;
  }

  .list {
    flex: 0 0 38%;
    min-height: 80px;
    overflow-y: auto;
    outline: none;
    border-bottom: 1px solid var(--border-strong);
  }

  .entry {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 26px;
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

  .hash {
    flex: none;
    width: 70px;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .subject {
    flex: 1;
    min-width: 0;
  }

  .renamed {
    flex: 0 1 auto;
    max-width: 30%;
    color: var(--warning);
    font-size: 12px;
  }

  .author {
    flex: none;
    width: 140px;
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
