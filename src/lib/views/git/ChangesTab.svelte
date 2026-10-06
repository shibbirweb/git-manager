<!-- The Changes tab (status bar > N changes): the uncommitted files of a repository, each
     compared with HEAD, staged and unstaged together. Follows the live status, and stages,
     unstages, discards and commits like the Changes sidebar. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { DEFAULT_CHANGES_LIST_WIDTH, MIN_CHANGES_LIST_WIDTH, settings } from "$lib/stores/settings.svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import { ignoreMenu } from "$lib/ignore/ignoreActions";
  import { openShelveDialog } from "$lib/shelf/shelfActions.svelte";
  import type { FileStatus, RevisionDiff } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import type { IconName } from "$lib/ui/icons";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import ResizeHandle from "$lib/ui/ResizeHandle.svelte";
  import LayoutToggleIcon from "../LayoutToggleIcon.svelte";
  import CommitBox from "../changes/CommitBox.svelte";
  import { splitPath, statusLetter, statusTitle } from "../changes/fileStatus";
  import { copyText, discard, stage, unstage } from "../changes/mutations";
  import {
    type ChangesTabAction,
    type ChangesTabFile,
    bulkTargets,
    changesListBounds,
    changesTabFiles,
    fileActions,
    pickSelected,
    stagedState,
    stepSelection,
  } from "./changesTab";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  const repo = $derived(repoStore.repos.find((candidate) => candidate.root === repoRoot) ?? null);
  const status = $derived(repoStore.statuses[repoRoot] ?? null);
  const files = $derived(changesTabFiles(status?.files ?? []));
  const unborn = $derived(status?.head.unborn ?? false);
  let selectedPath = $state<string | null>(null);
  const selected = $derived(pickSelected(files, selectedPath));

  /** The loaded diff and the file it belongs to, so a new selection never shows the old diff. */
  let loaded = $state.raw<{ path: string; diff: RevisionDiff } | null>(null);
  const result = $derived(loaded && loaded.path === selected?.path ? loaded.diff : null);
  let failed = $state.raw<{ path: string; message: string } | null>(null);
  const diffError = $derived(failed && failed.path === selected?.path ? failed.message : null);
  let diffToken = 0;
  /** Bumped on every diff load, so a binary preview reads the work tree file again. */
  let previewVersion = $state(0);
  let refreshing = $state(false);
  let bodyWidth = $state(0);
  const listVisible = $derived(settings.changesListVisible);
  const list = $derived(changesListBounds(settings.changesListWidth, bodyWidth, MIN_CHANGES_LIST_WIDTH));
  const selectedIndex = $derived(selected ? files.findIndex((file) => file.path === selected.path) : -1);
  const busy = $derived(repoStore.busy !== null);
  const bulk = $derived(bulkTargets(files));
  const conflictCount = $derived(files.filter((file) => file.status.conflicted).length);
  const repoName = $derived(repo?.name ?? splitPath(repoRoot).name);

  const actionButtons: Record<ChangesTabAction, { icon: IconName; title: string; danger?: boolean }> = {
    resolve: { icon: "merge", title: "Resolve in merge tool" },
    unstage: { icon: "minus", title: "Unstage" },
    discard: { icon: "discard", title: "Discard changes", danger: true },
    stage: { icon: "plus", title: "Stage" },
  };

  // A new status object means files changed on disk, so the diff loads again.
  $effect(() => {
    const file = selected;
    void status;
    untrack(() => void loadDiff(file));
  });

  async function loadDiff(file: ChangesTabFile | null): Promise<void> {
    const token = ++diffToken;
    if (!file || file.submodule || unborn) {
      loaded = null;
      failed = null;
      return;
    }
    try {
      const next = await api.compareWithRevision(repoRoot, file.path, "HEAD", file.origPath);
      if (token === diffToken) {
        loaded = { path: file.path, diff: next };
        failed = null;
        previewVersion++;
      }
    } catch (error) {
      if (token === diffToken) {
        loaded = null;
        failed = { path: file.path, message: errorMessage(error) };
      }
    }
  }

  const previewSides = $derived.by((): PreviewSides | null => {
    if (!result || !selected) {
      return null;
    }
    return {
      original: result.existsInRevision
        ? { kind: "revision", repoRoot, revision: result.commitId, filePath: selected.origPath ?? selected.path }
        : null,
      modified: { kind: "worktree", filePath: joinPath(repoRoot, selected.path) },
      version: previewVersion,
    };
  });

  function select(file: ChangesTabFile | null): void {
    if (file) {
      selectedPath = file.path;
      document.getElementById(rowId(file))?.scrollIntoView({ block: "nearest" });
    }
  }

  function openFile(file: ChangesTabFile): void {
    if (file.kind !== "deleted" && !file.submodule) {
      void repoStore.openFile(joinPath(repoRoot, file.path), { pin: true });
    }
  }

  function runAction(action: ChangesTabAction, file: FileStatus): void {
    if (action === "resolve") {
      void repoStore.openMerge(file.path, repoRoot);
    } else if (action === "unstage") {
      unstage(repoRoot, [file]);
    } else if (action === "discard") {
      void discard(repoRoot, [file], repoName);
    } else {
      stage(repoRoot, [file]);
    }
  }

  function rowMenu(event: MouseEvent, file: ChangesTabFile): void {
    event.preventDefault();
    select(file);
    const status = file.status;
    const actions = fileActions(status);
    let items: MenuItem[];
    if (status.conflicted) {
      items = [
        { label: "Resolve in Merge Tool", action: () => void repoStore.openMerge(status.path, repoRoot) },
        { label: "Show All Conflicts...", action: () => void repoStore.openConflicts(repoRoot) },
      ];
    } else {
      items = [];
      if (actions.includes("stage")) {
        items.push({ label: "Stage", action: () => stage(repoRoot, [status]), disabled: busy });
      }
      if (actions.includes("unstage")) {
        items.push({ label: "Unstage", action: () => unstage(repoRoot, [status]), disabled: busy });
      }
      if (actions.includes("discard")) {
        items.push({
          label: "Discard Changes...",
          action: () => void discard(repoRoot, [status], repoName),
          danger: true,
          disabled: busy,
        });
      }
      if (items.length > 0) {
        items.push({ separator: true });
      }
      if (file.kind !== "deleted" && !file.submodule) {
        items.push({ label: "Open File", action: () => openFile(file) });
      }
      if (!file.submodule) {
        items.push({ label: "Shelve Changes...", disabled: busy, action: () => openShelveDialog(repoRoot, [status.path]) });
      }
      const ignoreItem = ignoreMenu(repoRoot, status.path, status.path.endsWith("/"));
      if (ignoreItem) {
        items.push(ignoreItem);
      }
    }
    items.push({ separator: true }, { label: "Copy Path", action: () => copyText(status.path) });
    contextMenu.open(event, items);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      select(stepSelection(files, selected?.path ?? null, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && selected) {
      openFile(selected);
    }
  }

  function rowId(file: ChangesTabFile): string {
    return `changes-tab-${encodeURIComponent(file.path)}`;
  }

  async function refresh(): Promise<void> {
    refreshing = true;
    try {
      await repoStore.refreshRepoStatus(repoRoot);
    } finally {
      refreshing = false;
    }
  }
</script>

<div class="changes-tab">
  <div class="toolbar">
    <Icon name="git-compare" size={14} />
    <span class="title truncate">Uncommitted changes in <strong>{repoName}</strong></span>
    {#if !listVisible && selected}
      <!-- With the list hidden, the toolbar says which file the diff shows. -->
      <span class="current" title={selected.path}>
        <span class="letter kind-{selected.kind ?? 'conflicted'}">{statusLetter(selected.kind)}</span>
        <span class="truncate">{selected.path}</span>
        <span class="dim count">{selectedIndex + 1} of {files.length}</span>
      </span>
    {/if}
    <span class="spacer"></span>
    <button
      type="button"
      class="btn"
      onclick={() => select(stepSelection(files, selected?.path ?? null, -1))}
      disabled={selectedIndex <= 0}
      title="Previous file"
      aria-label="Previous file"
    >
      <Icon name="arrow-up" size={13} />
    </button>
    <button
      type="button"
      class="btn"
      onclick={() => select(stepSelection(files, selected?.path ?? null, 1))}
      disabled={selectedIndex < 0 || selectedIndex >= files.length - 1}
      title="Next file"
      aria-label="Next file"
    >
      <Icon name="arrow-down" size={13} />
    </button>
    <button
      type="button"
      class="btn"
      onclick={() => settings.toggleChangesList()}
      title={listVisible ? "Hide file list" : "Show file list"}
      aria-label={listVisible ? "Hide file list" : "Show file list"}
      aria-pressed={listVisible}
    >
      <LayoutToggleIcon side="left" visible={listVisible} size={14} />
    </button>
    <button type="button" class="btn" class:spinning={refreshing} onclick={() => void refresh()} title="Refresh">
      <Icon name="refresh" size={13} />
    </button>
  </div>
  {#if !repo}
    <div class="placeholder dim">This repository is no longer open.</div>
  {:else if !status}
    <div class="placeholder dim">Loading...</div>
  {:else}
    <div class="body" bind:clientWidth={bodyWidth}>
      {#if listVisible}
        <div class="side" style="width: {list.width}px">
          <div class="section-title">
            <span class="truncate">Changed files <span class="dim">({files.length})</span></span>
            <span class="bulk-actions">
              {#if bulk.unstage.length > 0}
                <button class="action" onclick={() => unstage(repoRoot, bulk.unstage)} disabled={busy} title="Unstage all">
                  <Icon name="minus" size={13} />
                </button>
              {/if}
              {#if bulk.discard.length > 0}
                <button
                  class="action danger"
                  onclick={() => void discard(repoRoot, bulk.discard, repoName)}
                  disabled={busy}
                  title="Discard all"
                >
                  <Icon name="discard" size={13} />
                </button>
              {/if}
              {#if bulk.stage.length > 0}
                <button class="action" onclick={() => stage(repoRoot, bulk.stage)} disabled={busy} title="Stage all">
                  <Icon name="plus" size={13} />
                </button>
              {/if}
            </span>
          </div>
          <div
            class="files"
            role="listbox"
            aria-label="Changed files"
            aria-activedescendant={selected ? rowId(selected) : undefined}
            tabindex="0"
            onkeydown={onKeydown}
          >
            {#each files as file (file.path)}
              {@const parts = splitPath(file.path)}
              {@const staged = stagedState(file.status)}
              <div
                id={rowId(file)}
                class="file"
                class:selected={file.path === selected?.path}
                role="option"
                tabindex="-1"
                aria-selected={file.path === selected?.path}
                title={`${statusTitle(file.kind)}: ${file.origPath ? `${file.origPath} -> ${file.path}` : file.path}`}
                onclick={() => select(file)}
                ondblclick={() => openFile(file)}
                oncontextmenu={(event) => rowMenu(event, file)}
                onkeydown={(event) => {
                  if (event.key === "Enter") {
                    openFile(file);
                  }
                }}
              >
                <span class="letter kind-{file.kind ?? 'conflicted'}">{statusLetter(file.kind)}</span>
                <span class="name truncate" class:deleted={file.kind === "deleted"}>{parts.name}</span>
                <span class="dir truncate dim">{parts.directory}</span>
                {#if staged}
                  <span class="tag" title={staged === "staged" ? "All changes are staged" : "Some changes are staged"}>{staged}</span>
                {/if}
                <span class="actions">
                  {#each fileActions(file.status) as action (action)}
                    {@const button = actionButtons[action]}
                    <button
                      class="action"
                      class:danger={button.danger}
                      title={button.title}
                      aria-label={button.title}
                      disabled={busy && action !== "resolve"}
                      onclick={(event) => {
                        event.stopPropagation();
                        runAction(action, file.status);
                      }}
                      ondblclick={(event) => event.stopPropagation()}
                    >
                      <Icon name={button.icon} size={13} />
                    </button>
                  {/each}
                </span>
              </div>
            {:else}
              <div class="empty dim">No uncommitted changes</div>
            {/each}
          </div>
          <!-- The sidebar's commit box: the draft is kept per repository, so both show the same message. -->
          <CommitBox {repo} stagedCount={bulk.unstage.length} {conflictCount} multiRepo={false} choices={[]} onpick={() => {}} />
        </div>
        <ResizeHandle
          label="Resize file list"
          panel="left"
          inPanel={true}
          size={list.width}
          min={MIN_CHANGES_LIST_WIDTH}
          max={list.max}
          defaultSize={DEFAULT_CHANGES_LIST_WIDTH}
          onResize={(width) => (settings.changesListWidth = width)}
          onCommit={() => settings.save()}
        />
      {/if}
      <div class="diff">
        {#if !selected}
          <div class="placeholder dim">Nothing to show: the working tree matches the last commit.</div>
        {:else if selected.submodule}
          <div class="placeholder dim">{selected.path} is a submodule. Open it as a repository to see its changes.</div>
        {:else if unborn}
          <div class="placeholder dim">No commits yet, so every file is new. Open a file to see it.</div>
        {:else if diffError}
          <div class="placeholder dim selectable">{diffError}</div>
        {:else if result}
          {#key selected.path}
            <DiffView
              diff={result.diff}
              path={selected.path}
              mode="readonly"
              leftLabel="HEAD"
              rightLabel="Working Tree"
              workingFile={selected.kind === "deleted" ? null : { filePath: joinPath(repoRoot, selected.path), sameLines: true }}
              {previewSides}
            />
          {/key}
        {:else}
          <div class="placeholder dim">Loading...</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .changes-tab {
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

  .current {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding-left: 8px;
    border-left: 1px solid var(--border);
    font-size: 12px;
  }

  .count {
    flex: none;
  }

  .spinning :global(svg) {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .side {
    flex: none;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-strong);
  }

  /* As tall as the diff's toolbar, so the lines under both meet. */
  .section-title {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 6px 0 10px;
    border-bottom: 1px solid var(--border-strong);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .bulk-actions {
    flex: none;
    display: flex;
    gap: 1px;
    margin-left: auto;
  }

  .actions {
    flex: none;
    display: none;
    gap: 1px;
  }

  .file:hover .actions {
    display: flex;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  .action:hover:not(:disabled) {
    background: var(--border-strong);
    color: var(--text);
  }

  .action.danger:hover:not(:disabled) {
    color: var(--danger);
  }

  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .tag {
    flex: none;
    padding: 0 5px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--text-dim);
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
  }

  .files {
    flex: 1;
    min-height: 0;
    padding: 2px 0;
    overflow-y: auto;
    outline: none;
  }

  .file {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 6px 0 10px;
    cursor: default;
  }

  .file:hover {
    background: var(--hover);
  }

  .file.selected {
    background: var(--selected-inactive);
  }

  .files:focus .file.selected {
    background: var(--selected);
  }

  .letter {
    flex: none;
    width: 12px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 700;
    text-align: center;
  }

  .kind-added {
    color: var(--success);
  }

  .kind-modified,
  .kind-typechange {
    color: var(--accent);
  }

  .kind-deleted {
    color: var(--danger);
    opacity: 0.8;
  }

  .kind-renamed {
    color: var(--tok-property);
  }

  .kind-untracked {
    color: color-mix(in srgb, var(--success) 60%, var(--text-faint));
  }

  .kind-conflicted {
    color: var(--danger);
  }

  .name {
    flex: 0 1 auto;
    min-width: 0;
  }

  .name.deleted {
    color: var(--text-dim);
    text-decoration: line-through;
    text-decoration-color: var(--text-faint);
  }

  .dir {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }

  .empty {
    padding: 10px;
  }

  .diff {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
  }

  .placeholder {
    padding: 24px;
    text-align: center;
  }
</style>
