<!--
  JetBrains' Shelf, in the bottom panel: the active repository's shelved change lists with their files.
  Double click (or Enter) on a file shows its diff; the right-click menus unshelve, rename and delete.
-->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ShelfEntry, ShelvedFile } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import {
    deleteEntry,
    openShelveDialog,
    renameEntry,
    shelfState,
    showShelvedDiff,
    unshelveEntry,
  } from "./shelfActions.svelte";
  import {
    changeLetter,
    clickSelection,
    fileCountLabel,
    fileKey,
    formatShelfDate,
    shelveCandidates,
    shelvedFileLabel,
    type ShelfFileKey,
    validSelection,
  } from "./shelfModel";

  const repoRoot = $derived(repoStore.repo?.root ?? null);
  const repoName = $derived(repoStore.repo?.name ?? "");
  const busy = $derived(repoStore.busy !== null);
  const changeCount = $derived(repoRoot ? shelveCandidates(repoStore.statuses[repoRoot]?.files ?? []).length : 0);

  let entries = $state.raw<ShelfEntry[]>([]);
  let loadError = $state<string | null>(null);
  let loaded = $state(false);
  let collapsed = $state.raw<Set<string>>(new Set());
  let selection = $state.raw<ShelfFileKey[]>([]);
  let loadToken = 0;

  const selectedKeys = $derived(new Set(selection.map(fileKey)));

  $effect(() => {
    void shelfState.version;
    void load(repoRoot);
  });

  async function load(targetRoot: string | null): Promise<void> {
    const token = ++loadToken;
    if (!targetRoot) {
      entries = [];
      loaded = true;
      return;
    }
    try {
      const next = await api.listShelf(targetRoot);
      if (token === loadToken) {
        entries = next ?? [];
        selection = validSelection(selection, entries);
        loadError = null;
        loaded = true;
      }
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
        loaded = true;
      }
    }
  }

  function toggle(shelfId: string): void {
    const next = new Set(collapsed);
    if (next.has(shelfId)) {
      next.delete(shelfId);
    } else {
      next.add(shelfId);
    }
    collapsed = next;
  }

  function selectFile(event: MouseEvent, entry: ShelfEntry, file: ShelvedFile): void {
    const key = { shelfId: entry.id, filePath: file.path };
    selection = clickSelection(selection, key, event.metaKey || event.ctrlKey);
  }

  function selectedPaths(entry: ShelfEntry): string[] {
    return selection.filter((key) => key.shelfId === entry.id).map((key) => key.filePath);
  }

  function entryMenu(event: MouseEvent, entry: ShelfEntry): void {
    if (!repoRoot) {
      return;
    }
    const root = repoRoot;
    const firstFile = entry.files[0];
    const items: MenuItem[] = [
      { label: "Unshelve...", disabled: busy, action: () => void unshelveEntry(root, entry) },
      {
        label: "Show Diff",
        disabled: !firstFile,
        action: () => (firstFile ? showShelvedDiff(root, entry.id, firstFile.path) : undefined),
      },
      { separator: true },
      { label: "Rename...", disabled: busy, action: () => void renameEntry(root, entry) },
      { label: "Delete...", danger: true, disabled: busy, action: () => void deleteEntry(root, entry) },
    ];
    contextMenu.open(event, items);
  }

  function fileMenu(event: MouseEvent, entry: ShelfEntry, file: ShelvedFile): void {
    if (!repoRoot) {
      return;
    }
    const root = repoRoot;
    if (!selectedKeys.has(fileKey({ shelfId: entry.id, filePath: file.path }))) {
      selection = [{ shelfId: entry.id, filePath: file.path }];
    }
    const paths = selectedPaths(entry);
    const items: MenuItem[] = [
      { label: "Show Diff", action: () => showShelvedDiff(root, entry.id, file.path) },
      { separator: true },
      {
        label: paths.length > 1 ? `Unshelve ${fileCountLabel(paths.length)}...` : "Unshelve Selected Files...",
        disabled: busy,
        action: () => void unshelveEntry(root, entry, paths),
      },
      { label: "Unshelve All...", disabled: busy, action: () => void unshelveEntry(root, entry) },
    ];
    contextMenu.open(event, items);
  }

  function fileKeydown(event: KeyboardEvent, entry: ShelfEntry, file: ShelvedFile): void {
    if (event.key === "Enter" && repoRoot) {
      event.preventDefault();
      showShelvedDiff(repoRoot, entry.id, file.path);
    }
  }

  function fileName(filePath: string): string {
    return filePath.slice(filePath.lastIndexOf("/") + 1);
  }

  function folderOf(filePath: string): string {
    const slash = filePath.lastIndexOf("/");
    return slash > 0 ? filePath.slice(0, slash) : "";
  }
</script>

<div class="shelf">
  <div class="toolbar">
    <span class="repo truncate dim" title={repoRoot ?? ""}>{repoName}</span>
    <div class="spacer"></div>
    <button
      class="btn small"
      onclick={() => openShelveDialog(repoRoot)}
      disabled={!repoRoot || busy || changeCount === 0}
      title={changeCount === 0 ? "There are no changes to shelve" : "Shelve Changes..."}
    >
      Shelve Changes...
    </button>
    <button class="icon-btn small" onclick={() => void load(repoRoot)} disabled={!repoRoot} title="Refresh" aria-label="Refresh">
      <Icon name="refresh" size={14} />
    </button>
  </div>

  {#if !repoRoot}
    <div class="placeholder dim">Open a repository to see its shelf.</div>
  {:else if loadError}
    <div class="placeholder dim">Could not read the shelf: {loadError}</div>
  {:else if loaded && entries.length === 0}
    <div class="placeholder dim">
      No shelved changes. Shelve Changes puts changes aside without committing them.
    </div>
  {:else}
    <ul class="list" role="tree" aria-label="Shelved changes">
      {#each entries as entry (entry.id)}
        {@const open = !collapsed.has(entry.id)}
        <li role="treeitem" aria-expanded={open} aria-selected="false">
          <button
            class="entry"
            onclick={() => toggle(entry.id)}
            oncontextmenu={(event) => entryMenu(event, entry)}
            title="{entry.name}{entry.branch ? `\nFrom ${entry.branch}` : ''}\n{formatShelfDate(entry.createdAt)}"
          >
            <Icon name={open ? "chevron-down" : "chevron-right"} size={12} />
            <Icon name="stash" size={14} />
            <span class="name truncate">{entry.name}</span>
            <span class="meta dim">{fileCountLabel(entry.files.length)}</span>
            <span class="meta dim">{formatShelfDate(entry.createdAt)}</span>
          </button>
          <span class="entry-actions">
            <button
              class="icon-btn tiny"
              disabled={busy}
              onclick={() => repoRoot && void unshelveEntry(repoRoot, entry)}
              title="Unshelve..."
              aria-label="Unshelve {entry.name}"
            >
              <Icon name="arrow-up" size={13} />
            </button>
            <button
              class="icon-btn tiny danger"
              disabled={busy}
              onclick={() => repoRoot && void deleteEntry(repoRoot, entry)}
              title="Delete..."
              aria-label="Delete {entry.name}"
            >
              <Icon name="trash" size={13} />
            </button>
          </span>
          {#if open}
            <ul role="group">
              {#each entry.files as file (file.path)}
                {@const selected = selectedKeys.has(fileKey({ shelfId: entry.id, filePath: file.path }))}
                <li role="treeitem" aria-selected={selected}>
                  <button
                    class="file"
                    class:selected
                    onclick={(event) => selectFile(event, entry, file)}
                    ondblclick={() => repoRoot && showShelvedDiff(repoRoot, entry.id, file.path)}
                    onkeydown={(event) => fileKeydown(event, entry, file)}
                    oncontextmenu={(event) => fileMenu(event, entry, file)}
                    title="{shelvedFileLabel(file)}{file.binary ? ' (binary)' : ''}"
                  >
                    <span class="letter mono {file.change}">{changeLetter(file.change)}</span>
                    <span class="file-name truncate">{fileName(file.path)}</span>
                    <span class="folder truncate dim">{folderOf(file.path)}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .shelf {
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
    gap: 6px;
    height: 32px;
    padding: 0 8px 0 12px;
    border-bottom: 1px solid var(--border);
  }

  .repo {
    min-width: 0;
    font-size: 12px;
  }

  .spacer {
    flex: 1;
  }

  .icon-btn.small {
    height: 24px;
    min-width: 24px;
    color: var(--text-dim);
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    text-align: center;
  }

  .list,
  .list ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 0;
  }

  .list > li {
    position: relative;
  }

  .entry,
  .file {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 24px;
    padding: 0 10px;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: default;
    white-space: nowrap;
  }

  .entry :global(svg) {
    flex: none;
    color: var(--text-dim);
  }

  .entry {
    padding-right: 64px;
  }

  .entry:hover,
  .file:hover {
    background: var(--hover);
  }

  .entry:focus-visible,
  .file:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }

  .file {
    padding-left: 44px;
  }

  .file.selected {
    background: var(--selected);
  }

  .name {
    flex: 0 1 auto;
    min-width: 0;
    font-weight: 500;
  }

  .meta {
    flex: none;
    font-size: 11.5px;
  }

  .entry-actions {
    position: absolute;
    top: 0;
    right: 8px;
    height: 24px;
    display: none;
    align-items: center;
    gap: 2px;
  }

  .list > li:hover > .entry-actions,
  .entry-actions:focus-within {
    display: flex;
  }

  .icon-btn.tiny {
    height: 20px;
    min-width: 20px;
    color: var(--text-dim);
  }

  .icon-btn.tiny.danger:hover:not(:disabled) {
    color: var(--danger);
  }

  .letter {
    flex: none;
    width: 12px;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .letter.added {
    color: var(--success);
  }

  .letter.deleted {
    color: var(--text-faint);
  }

  .letter.modified,
  .letter.renamed,
  .letter.copied {
    color: var(--accent);
  }

  .file-name {
    flex: 0 1 auto;
    min-width: 0;
  }

  .folder {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 11.5px;
  }
</style>
