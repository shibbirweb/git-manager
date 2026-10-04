<!--
  The Git Console: every git command the app ran, newest last.
  Mounted only while it is on screen: it loads the backend's list, then follows the "git-command" events.
-->
<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { api, errorMessage, onGitCommand } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { GitCommandEntry } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import {
    commandText,
    formatDuration,
    formatTime,
    isAtBottom,
    listLayout,
    matchesFilter,
    mergeEntries,
    outputBlocks,
    outputHeight,
    repoName,
    ROW_HEIGHT,
    statusOf,
    upsertEntry,
    visibleRange,
  } from "./consoleModel";

  let entries = $state.raw<GitCommandEntry[]>([]);
  let openIds = $state.raw<Set<number>>(new Set());
  let filter = $state("");
  let loadError = $state<string | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let listEl = $state<HTMLDivElement | null>(null);
  /** Keeps the newest command in view until the user scrolls up. */
  let follow = true;
  let loaded = false;
  let early: GitCommandEntry[] = [];
  let unlisten: (() => void) | null = null;
  let destroyed = false;

  const filtered = $derived(filter.trim() ? entries.filter((entry) => matchesFilter(entry, filter)) : entries);
  const layout = $derived(listLayout(filtered, openIds));
  const range = $derived(visibleRange(layout, scrollTop, viewportHeight));
  const visible = $derived(filtered.slice(range.start, range.end));

  onMount(() => {
    void start();
  });

  onDestroy(() => {
    destroyed = true;
    unlisten?.();
  });

  async function start(): Promise<void> {
    try {
      const stop = await onGitCommand((entry) => received(entry));
      if (destroyed) {
        stop();
        return;
      }
      unlisten = stop;
      const list = await api.gitConsoleEntries();
      entries = mergeEntries(list ?? [], early);
      early = [];
      loaded = true;
      loadError = null;
      void scrollToEnd();
    } catch (error) {
      loadError = errorMessage(error);
    }
  }

  function received(entry: GitCommandEntry): void {
    if (!loaded) {
      early.push(entry);
      return;
    }
    entries = upsertEntry(entries, entry);
    if (follow) {
      void scrollToEnd();
    }
  }

  async function scrollToEnd(): Promise<void> {
    await tick();
    if (listEl) {
      listEl.scrollTop = listEl.scrollHeight;
      scrollTop = listEl.scrollTop;
    }
  }

  function onScroll(): void {
    if (!listEl) {
      return;
    }
    scrollTop = listEl.scrollTop;
    follow = isAtBottom(listEl.scrollTop, listEl.clientHeight, listEl.scrollHeight);
  }

  function toggle(entryId: number): void {
    const next = new Set(openIds);
    if (next.has(entryId)) {
      next.delete(entryId);
    } else {
      next.add(entryId);
    }
    openIds = next;
  }

  async function clear(): Promise<void> {
    try {
      await api.gitConsoleClear();
      entries = [];
      openIds = new Set();
      follow = true;
    } catch (error) {
      toast.error("Could not clear the console", errorMessage(error));
    }
  }

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function outputText(entry: GitCommandEntry): string {
    return [entry.stdout, entry.stderr, entry.error ?? ""].map((text) => (text ?? "").replace(/\s+$/, "")).filter(Boolean).join("\n");
  }

  function openMenu(event: MouseEvent, entry: GitCommandEntry): void {
    const output = outputText(entry);
    contextMenu.open(event, [
      { label: "Copy Command", action: () => void copy(commandText(entry)) },
      { label: "Copy Output", disabled: output === "", action: () => void copy(output) },
      { separator: true },
      { label: openIds.has(entry.id) ? "Hide Output" : "Show Output", action: () => toggle(entry.id) },
    ]);
  }

  function repoLabel(repoPath: string): string {
    return repoStore.repos.find((repo) => repo.root === repoPath)?.name ?? repoName(repoPath);
  }

  function statusTitle(entry: GitCommandEntry): string {
    const status = statusOf(entry);
    if (status === "running") {
      return "Running";
    }
    if (entry.error) {
      return `Failed: ${entry.error}`;
    }
    return status === "success" ? "Exit code 0" : `Failed, exit code ${entry.exitCode ?? "unknown"}`;
  }
</script>

<div class="console">
  <div class="toolbar">
    <div class="filter">
      <Icon name="search" size={13} />
      <input class="filter-input" placeholder="Filter commands" aria-label="Filter commands" bind:value={filter} spellcheck="false" />
      {#if filter}
        <button class="icon-btn tiny" onclick={() => (filter = "")} title="Clear filter" aria-label="Clear filter">
          <Icon name="x" size={12} />
        </button>
      {/if}
    </div>
    <span class="count dim">
      {filter.trim() ? `${filtered.length} of ${entries.length}` : entries.length}
      {entries.length === 1 ? "command" : "commands"}
    </span>
    <div class="spacer"></div>
    <button class="btn small" onclick={() => void clear()} disabled={entries.length === 0} title="Clear the console">Clear</button>
  </div>

  {#if loadError}
    <div class="placeholder dim">Could not load the Git Console: {loadError}</div>
  {:else if filtered.length === 0}
    <div class="placeholder dim">
      {entries.length === 0 ? "Git commands the app runs show up here." : "No commands match the filter."}
    </div>
  {:else}
    <div class="list" bind:this={listEl} bind:clientHeight={viewportHeight} onscroll={onScroll} role="list" aria-label="Git commands">
      <div class="spacer-box" style="height: {layout.total}px">
        {#each visible as entry, index (entry.id)}
          {@const open = openIds.has(entry.id)}
          {@const status = statusOf(entry)}
          <div class="entry" role="listitem" style="top: {layout.offsets[range.start + index]}px">
            <button
              class="row"
              style="height: {ROW_HEIGHT}px"
              onclick={() => toggle(entry.id)}
              oncontextmenu={(event) => openMenu(event, entry)}
              aria-expanded={open}
              title={commandText(entry)}
            >
              <Icon name={open ? "chevron-down" : "chevron-right"} size={12} />
              <span class="time dim">{formatTime(entry.startedAt)}</span>
              <span class="repo truncate">{repoLabel(entry.repoPath)}</span>
              <span class="command truncate">{commandText(entry)}</span>
              <span class="duration dim">{formatDuration(entry.durationMs)}</span>
              <span class="status {status}" title={statusTitle(entry)} aria-label={statusTitle(entry)}></span>
            </button>
            {#if open}
              <div class="output selectable" style="height: {outputHeight(entry)}px">
                {#each outputBlocks(entry) as block, blockIndex (blockIndex)}
                  <pre class="block {block.kind}">{block.text}</pre>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .console {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--editor-bg);
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 8px 0 10px;
    border-bottom: 1px solid var(--border);
  }

  .filter {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 260px;
    max-width: 50%;
    height: 24px;
    padding: 0 4px 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--text-dim);
  }

  .filter:focus-within {
    border-color: var(--accent);
  }

  .filter-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 12px;
  }

  .icon-btn.tiny {
    height: 18px;
    min-width: 18px;
    color: var(--text-dim);
  }

  .count {
    font-size: 11.5px;
    white-space: nowrap;
  }

  .spacer {
    flex: 1;
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    text-align: center;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .spacer-box {
    position: relative;
    min-width: 100%;
  }

  .entry {
    position: absolute;
    left: 0;
    right: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 0 10px 0 8px;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: default;
    white-space: nowrap;
  }

  .row:hover {
    background: var(--hover);
  }

  .row:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }

  .row :global(svg) {
    flex: none;
    color: var(--text-dim);
  }

  .time {
    flex: none;
    font-variant-numeric: tabular-nums;
  }

  .repo {
    flex: 0 1 auto;
    max-width: 140px;
    color: var(--text-dim);
  }

  .command {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--code-size);
  }

  .duration {
    flex: none;
    font-variant-numeric: tabular-nums;
  }

  .status {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }

  .status.success {
    background: var(--success);
  }

  .status.failed {
    background: var(--danger);
  }

  .status.running {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }

  .output {
    box-sizing: border-box;
    margin: 0 10px 0 28px;
    padding: 5px 8px;
    overflow: auto;
    border-left: 2px solid var(--border-strong);
    background: var(--panel-alt);
  }

  .block {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 17px;
    white-space: pre;
    color: var(--text);
  }

  .block.stderr {
    color: var(--text-dim);
  }

  .block.error {
    color: var(--danger);
  }

  .block.note {
    color: var(--text-faint);
    font-style: italic;
  }
</style>
