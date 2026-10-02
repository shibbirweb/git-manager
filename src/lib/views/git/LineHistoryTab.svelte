<!-- Show History for Selection: the commits that changed some lines of a file
     (`git log -L`), newest first, with each commit's diff of those lines. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { LineHistoryEntry } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { patchLines } from "./patchLines";

  interface Props {
    repoRoot: string;
    filePath: string;
    startLine: number;
    endLine: number;
  }

  let { repoRoot, filePath, startLine, endLine }: Props = $props();

  const LIMIT = 200;

  let entries = $state.raw<LineHistoryEntry[]>([]);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let token = 0;
  const now = Date.now();

  const selected = $derived(entries.find((entry) => entry.commit.id === selectedId) ?? null);
  const lines = $derived(selected ? patchLines(selected.patch) : []);
  const rangeLabel = $derived(startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`);

  $effect(() => {
    void [repoRoot, filePath, startLine, endLine];
    untrack(() => void load());
  });

  async function load(): Promise<void> {
    const current = ++token;
    loading = true;
    loadError = null;
    try {
      const result = await api.lineHistory(repoRoot, filePath, startLine, endLine, LIMIT);
      if (current === token) {
        entries = result;
        selectedId = result[0]?.commit.id ?? null;
      }
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

  function select(index: number): void {
    const entry = entries[Math.max(0, Math.min(entries.length - 1, index))];
    if (entry) {
      selectedId = entry.commit.id;
      requestAnimationFrame(() => listEl?.querySelector(`[data-commit="${entry.commit.id}"]`)?.scrollIntoView({ block: "nearest" }));
    }
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

  function openCommit(entry: LineHistoryEntry): void {
    repoStore.openCommitTab(repoRoot, entry.commit.id, { summary: entry.commit.summary, filePath });
  }
</script>

<div class="line-history">
  <div class="toolbar">
    <Icon name="history" size={14} />
    <span class="title truncate">History of {rangeLabel} of <span class="mono">{filePath}</span></span>
    <span class="spacer"></span>
    {#if loading}
      <span class="dim">Loading...</span>
    {:else}
      <span class="count dim">{entries.length}{entries.length >= LIMIT ? "+" : ""} {entries.length === 1 ? "commit" : "commits"}</span>
    {/if}
    <button class="icon-btn" onclick={() => void load()} disabled={loading} title="Refresh">
      <Icon name="refresh" size={14} />
    </button>
  </div>
  {#if loadError}
    <div class="placeholder">
      <div>Could not trace these lines</div>
      <div class="dim selectable">{loadError}</div>
      <div class="hint dim">Line numbers are those of the last commit; uncommitted edits can shift them.</div>
    </div>
  {:else}
    <div class="list" bind:this={listEl} role="listbox" tabindex="0" aria-label="Commits" onkeydown={onKeydown}>
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
        >
          <span class="hash mono">{entry.commit.shortId}</span>
          <span class="subject truncate" title={entry.commit.summary}>{entry.commit.summary}</span>
          <span class="author truncate dim">{entry.commit.authorName}</span>
          <span class="when dim" title={fullDate(entry.commit.time)}>{relativeTime(entry.commit.time, now)}</span>
        </div>
      {:else}
        {#if !loading}
          <div class="placeholder dim">No commits changed these lines.</div>
        {/if}
      {/each}
    </div>
    <div class="patch-pane">
      {#if selected}
        <div class="patch-head">
          <span class="truncate">{selected.commit.summary}</span>
          <span class="spacer"></span>
          <button class="btn small" onclick={() => openCommit(selected)}>Open Commit</button>
        </div>
        <div class="patch mono selectable" role="document">
          {#each lines as line, index (index)}
            <div class="line {line.kind}">{line.text || " "}</div>
          {/each}
          {#if selected.truncated}
            <div class="line hunk">... the diff is cut short; open the commit to see all of it</div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .line-history {
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
    flex: 0 0 34%;
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

  .patch-pane {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
  }

  .patch-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
  }

  .patch {
    flex: 1;
    overflow: auto;
    padding: 6px 0;
    font-size: var(--code-size);
    line-height: 1.5;
    white-space: pre;
  }

  .line {
    padding: 0 12px;
    min-width: max-content;
  }

  .line.file {
    color: var(--text-dim);
    font-weight: 600;
  }

  .line.hunk {
    color: var(--accent);
    background: var(--panel-alt);
  }

  .line.added {
    background: var(--diff-added);
  }

  .line.deleted {
    background: var(--diff-deleted);
  }

  .placeholder {
    padding: 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hint {
    font-size: 12px;
  }
</style>
