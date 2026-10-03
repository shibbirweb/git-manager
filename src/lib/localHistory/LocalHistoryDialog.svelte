<!-- Local History window, like JetBrains': a file's kept versions on the left, the selected one
     against the current text on the right, with Revert, Restore and Copy. Recently Deleted lists
     files that are gone from disk but still have versions. Loaded only while open. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { fileCommands } from "$lib/stores/fileCommands.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { baseName, folderFor, parentOf, relativeTo } from "$lib/stores/workspacePaths";
  import type { DeletedLocalFile, FileDiff, FileLocalHistory, LocalSnapshot } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { localHistory } from "./localHistory.svelte";
  import { groupByDay, isSafetyCopy, movedSelection, sizeText, snapshotLabel, timeText } from "./localHistoryModel";

  const target = $derived(localHistory.target);
  const filePath = $derived(target?.kind === "file" ? target.filePath : null);

  let history = $state.raw<FileLocalHistory | null>(null);
  let deleted = $state.raw<DeletedLocalFile[] | null>(null);
  let loadError = $state<string | null>(null);
  let selectedHash = $state<string | null>(null);
  let diff = $state.raw<FileDiff | null>(null);
  let diffError = $state<string | null>(null);
  let working = $state(false);
  let listEl = $state<HTMLDivElement | null>(null);
  let loadToken = 0;
  let diffToken = 0;

  const snapshots = $derived(history?.snapshots ?? []);
  const selectedIndex = $derived(snapshots.findIndex((snapshot) => snapshot.hash === selectedHash));
  const selected = $derived(selectedIndex >= 0 ? snapshots[selectedIndex] : null);
  const groups = $derived(groupByDay(snapshots, Date.now()));
  const dirty = $derived(filePath !== null && repoStore.isDirty(filePath));
  const textual = $derived(diff !== null && !diff.binary && !diff.tooLarge);
  const folders = $derived(repoStore.workspace?.folders ?? []);

  function displayPath(absolute: string): string {
    const folder = folderFor(folders, absolute);
    return folder ? `${folder.name}/${relativeTo(folder.root, absolute)}` : absolute;
  }

  // A file's versions, read again after Clear Local History.
  $effect(() => {
    const shownPath = filePath;
    void localHistory.version;
    if (shownPath) {
      void loadHistory(shownPath, true);
    }
  });

  // Recently Deleted.
  $effect(() => {
    const current = target;
    void localHistory.version;
    if (current?.kind === "deleted") {
      void loadDeleted(current.folderPaths);
    }
  });

  $effect(() => {
    const shownPath = filePath;
    const shownHash = selectedHash;
    if (shownPath && shownHash) {
      void loadDiff(shownPath, shownHash);
    } else {
      diff = null;
      diffError = null;
    }
  });

  async function loadHistory(historyPath: string, selectFirst: boolean): Promise<void> {
    const token = ++loadToken;
    try {
      const next = await api.localHistoryList(historyPath);
      if (token !== loadToken) {
        return;
      }
      history = next;
      loadError = null;
      if (selectFirst || !next.snapshots.some((snapshot) => snapshot.hash === selectedHash)) {
        selectedHash = next.snapshots[0]?.hash ?? null;
      }
    } catch (error) {
      if (token === loadToken) {
        history = null;
        loadError = errorMessage(error);
      }
    }
  }

  async function loadDeleted(folderPaths: string[]): Promise<void> {
    const token = ++loadToken;
    history = null;
    selectedHash = null;
    try {
      const next = await api.localHistoryDeleted(folderPaths);
      if (token === loadToken) {
        deleted = next;
        loadError = null;
      }
    } catch (error) {
      if (token === loadToken) {
        deleted = null;
        loadError = errorMessage(error);
      }
    }
  }

  async function loadDiff(historyPath: string, snapshotHash: string): Promise<void> {
    const token = ++diffToken;
    // Unsaved edits are part of "now"; otherwise the backend reads the file.
    const currentText = repoStore.isDirty(historyPath) ? fileCommands.text(historyPath) : null;
    try {
      const next = await api.localHistoryDiff(historyPath, snapshotHash, currentText);
      if (token === diffToken) {
        diff = next;
        diffError = null;
      }
    } catch (error) {
      if (token === diffToken) {
        diff = null;
        diffError = errorMessage(error);
      }
    }
  }

  async function revert(): Promise<void> {
    if (!filePath || !diff || !textual || working) {
      return;
    }
    working = true;
    const done = await localHistory.revert(filePath, diff.original);
    working = false;
    if (done) {
      localHistory.close();
    }
  }

  async function restore(): Promise<void> {
    if (!filePath || !selected || working) {
      return;
    }
    working = true;
    const done = await localHistory.restore(filePath, selected.hash);
    working = false;
    if (done) {
      await loadHistory(filePath, false);
    }
  }

  function onListKeydown(event: KeyboardEvent): void {
    const next = movedSelection(snapshots.length, selectedIndex, event.key);
    if (next !== selectedIndex && next >= 0) {
      event.preventDefault();
      selectedHash = snapshots[next].hash;
      listEl?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }

  function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || dialogs.active !== null || event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    localHistory.close();
  }

  function snapshotTitle(snapshot: LocalSnapshot): string {
    return `${snapshotLabel(snapshot.label)}, ${fullDate(Math.floor(snapshot.time / 1000))}, ${sizeText(snapshot.size)}`;
  }

  const rightLabel = $derived(history && !history.exists ? "Deleted" : dirty ? "Current (unsaved)" : "Current");
  const leftLabel = $derived(selected ? `${snapshotLabel(selected.label)}, ${timeText(selected.time)}` : "Version");
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div
  class="overlay"
  role="presentation"
  onmousedown={(event) => {
    if (event.target === event.currentTarget) {
      localHistory.close();
    }
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Local History">
    <header class="head">
      {#if target?.kind === "file" && target.fromDeleted}
        <button
          class="icon-btn"
          onclick={() => target.fromDeleted && localHistory.openDeleted(target.fromDeleted)}
          title="Back to Recently Deleted"
          aria-label="Back"
        >
          <Icon name="arrow-left" size={14} />
        </button>
      {/if}
      <Icon name="history" size={15} />
      {#if filePath}
        <h2>Local History: {baseName(filePath)}</h2>
        <span class="path dim selectable" title={filePath}>{displayPath(parentOf(filePath))}</span>
      {:else}
        <h2>Recently Deleted</h2>
        <span class="path dim">Files that are gone but still have versions in Local History</span>
      {/if}
      <span class="spacer"></span>
      <button class="icon-btn" onclick={() => localHistory.close()} title="Close" aria-label="Close">
        <Icon name="x" size={14} />
      </button>
    </header>

    {#if loadError}
      <div class="placeholder">
        <Icon name="alert" size={18} />
        <div>Could not read Local History</div>
        <div class="dim selectable">{loadError}</div>
      </div>
    {:else if target?.kind === "deleted"}
      {#if deleted === null}
        <div class="placeholder dim">Loading...</div>
      {:else if deleted.length === 0}
        <div class="placeholder dim">No deleted files with Local History</div>
      {:else}
        <div class="deleted-list">
          {#each deleted as item (item.filePath)}
            <button class="deleted-row" onclick={() => localHistory.openFile(item.filePath, target.folderPaths)}>
              <Icon name="file" size={13} />
              <span class="name">{baseName(item.filePath)}</span>
              <span class="dim folder" title={item.filePath}>{displayPath(parentOf(item.filePath))}</span>
              <span class="dim when" title={fullDate(Math.floor(item.latest.time / 1000))}>
                {relativeTime(Math.floor(item.latest.time / 1000))}
              </span>
              <span class="dim count">{item.count} {item.count === 1 ? "version" : "versions"}</span>
            </button>
          {/each}
        </div>
      {/if}
    {:else if history === null}
      <div class="placeholder dim">Loading...</div>
    {:else if snapshots.length === 0}
      <div class="placeholder dim">
        <div>No versions of this file yet</div>
        <div>Versions are kept on save, on outside changes and before discards.</div>
      </div>
    {:else}
      <div class="body">
        <div class="versions" bind:this={listEl} role="listbox" tabindex="0" aria-label="Versions" onkeydown={onListKeydown}>
          {#each groups as group (group.title)}
            <div class="day">{group.title}</div>
            {#each group.snapshots as snapshot (snapshot.hash + snapshot.time)}
              {@const index = snapshots.indexOf(snapshot)}
              <button
                class="version"
                class:selected={snapshot.hash === selectedHash}
                data-index={index}
                role="option"
                aria-selected={snapshot.hash === selectedHash}
                title={snapshotTitle(snapshot)}
                onclick={() => {
                  selectedHash = snapshot.hash;
                  listEl?.focus();
                }}
              >
                <span class="time">{timeText(snapshot.time)}</span>
                <span class="label" class:safety={isSafetyCopy(snapshot.label)}>{snapshotLabel(snapshot.label)}</span>
              </button>
            {/each}
          {/each}
        </div>
        <div class="compare">
          <div class="toolbar">
            {#if history.exists}
              <button class="btn small primary" disabled={!textual || working} onclick={() => void revert()}>
                Revert to This
              </button>
            {:else}
              <button class="btn small primary" disabled={!selected || working} onclick={() => void restore()}>
                Restore File
              </button>
            {/if}
            <button class="btn small" disabled={!textual} onclick={() => diff && void localHistory.copy(diff.original)}>Copy</button>
            <span class="hint dim">
              {#if history.exists}
                Revert puts this version in the editor; Undo takes it back.
              {:else}
                The file is deleted. Restore writes this version back.
              {/if}
            </span>
          </div>
          {#if diffError}
            <div class="placeholder">
              <Icon name="alert" size={18} />
              <div class="dim selectable">{diffError}</div>
            </div>
          {:else if diff && filePath}
            <div class="diff">
              <DiffView
                {diff}
                path={filePath}
                mode="readonly"
                {leftLabel}
                {rightLabel}
                workingFile={history.exists ? { filePath, sameLines: true } : null}
              />
            </div>
          {:else}
            <div class="placeholder dim">Loading...</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 840;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay);
  }

  .dialog {
    width: min(1200px, calc(100vw - 32px));
    height: min(820px, calc(100vh - 48px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: var(--shadow);
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-strong);
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }

  .path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .spacer {
    flex: 1;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .versions {
    flex: none;
    width: 240px;
    overflow-y: auto;
    padding: 4px 0 8px;
    border-right: 1px solid var(--border-strong);
    background: var(--panel-alt);
    outline: none;
  }

  .day {
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .version {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 4px 12px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }

  .version:hover {
    background: var(--hover);
  }

  .version.selected {
    background: var(--selected-inactive);
  }

  .versions:focus-within .version.selected {
    background: var(--selected);
  }

  .time {
    flex: none;
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-dim);
  }

  .label.safety {
    color: var(--warning);
  }

  .compare {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .hint {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .diff {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
  }

  .deleted-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 0;
  }

  .deleted-row {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 14px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }

  .deleted-row:hover {
    background: var(--hover);
  }

  .deleted-row .name {
    flex: none;
    font-weight: 600;
  }

  .deleted-row .folder {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .deleted-row .when,
  .deleted-row .count {
    flex: none;
    font-size: 11.5px;
  }

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
  }
</style>
