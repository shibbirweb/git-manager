<!-- Right sidebar: the work tree, loaded one folder at a time. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { baseName, folderFor, joinPath, locateAbsolute, parentOf, relativeTo } from "$lib/stores/workspacePaths";
  import type { FileStatus } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { pickAndAddFolder } from "../repoPicker";
  import { deletedByFolder, type FileTone, marksByPath, tonesByPath } from "./tones";

  // Every path in the tree is absolute, so several workspace folders never collide.
  interface TreeEntry {
    name: string;
    path: string;
    isDir: boolean;
    ignored: boolean;
    isRepo: boolean;
    /** Deleted from the work tree but still known to git. */
    deleted: boolean;
    /** A top-level workspace folder (multi-folder workspaces only). */
    isFolderRoot: boolean;
  }

  interface Row {
    entry: TreeEntry;
    depth: number;
    expanded: boolean;
  }

  const ROW_HEIGHT = 24;
  const OVERSCAN = 10;

  /** Loaded directory contents keyed by absolute directory path. */
  let children = $state.raw<Map<string, TreeEntry[]>>(new Map());
  let expanded = $state.raw<Set<string>>(new Set());
  let truncated = $state.raw<Set<string>>(new Set());
  let selectedPath = $state<string | null>(null);
  let rootErrors = $state.raw<Map<string, string>>(new Map());
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let listEl = $state<HTMLDivElement | null>(null);

  const folders = $derived(repoStore.workspace?.folders ?? []);
  const multiRoot = $derived(folders.length > 1);

  /** Changed files of every repository, with absolute paths. */
  const workspaceFiles = $derived.by(() => {
    const files: FileStatus[] = [];
    for (const repo of repoStore.repos) {
      for (const file of repoStore.statuses[repo.root]?.files ?? []) {
        // A nested repository shows up in its parent as an untracked "dir/".
        if (file.path.endsWith("/")) {
          continue;
        }
        files.push({
          ...file,
          path: joinPath(repo.root, file.path),
          origPath: file.origPath ? joinPath(repo.root, file.origPath) : null,
        });
      }
    }
    return files;
  });
  const tones = $derived(tonesByPath(workspaceFiles));
  const marks = $derived(marksByPath(workspaceFiles));
  const deleted = $derived(deletedByFolder(workspaceFiles));
  const repoRoots = $derived(repoStore.repos.map((repo) => repo.root));
  const repoRootSet = $derived(new Set(repoRoots));

  /** Branch shown next to a repository folder. */
  function branchOf(dirPath: string): string | null {
    const head = repoStore.statuses[dirPath]?.head;
    return head?.branch ?? head?.shortId ?? null;
  }

  function compareEntries(a: TreeEntry, b: TreeEntry): number {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    const left = a.name.toLowerCase();
    const right = b.name.toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  }

  /** Directory contents on disk plus files git knows were deleted there. */
  function entriesOf(dirPath: string): TreeEntry[] {
    const onDisk = children.get(dirPath);
    if (!onDisk) {
      return [];
    }
    const gone = deleted.get(dirPath) ?? [];
    if (gone.length === 0) {
      return onDisk;
    }
    const entries = onDisk.slice();
    const present = new Set(onDisk.map((entry) => entry.path));
    for (const path of gone) {
      if (!present.has(path)) {
        entries.push({ name: baseName(path), path, isDir: false, ignored: false, isRepo: false, deleted: true, isFolderRoot: false });
      }
    }
    return entries.sort(compareEntries);
  }

  const rows = $derived.by(() => {
    const out: Row[] = [];
    const walk = (dirPath: string, depth: number) => {
      for (const entry of entriesOf(dirPath)) {
        const isOpen = entry.isDir && expanded.has(entry.path);
        out.push({ entry, depth, expanded: isOpen });
        if (isOpen) {
          walk(entry.path, depth + 1);
        }
      }
    };
    if (multiRoot) {
      // Each workspace folder is a top-level row, like VS Code's multi-root explorer.
      for (const folder of folders) {
        const isOpen = expanded.has(folder.root);
        out.push({
          entry: {
            name: folder.name,
            path: folder.root,
            isDir: true,
            ignored: false,
            isRepo: repoRootSet.has(folder.root),
            deleted: false,
            isFolderRoot: true,
          },
          depth: 0,
          expanded: isOpen,
        });
        if (isOpen) {
          walk(folder.root, 1);
        }
      }
    } else if (folders[0]) {
      walk(folders[0].root, 0);
    }
    return out;
  });

  const firstVisible = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
  const lastVisible = $derived(Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN));
  const visibleRows = $derived(rows.slice(firstVisible, lastVisible));
  const singleRootError = $derived(!multiRoot && folders[0] ? (rootErrors.get(folders[0].root) ?? null) : null);

  // Load newly added folders (expanded) and forget removed ones.
  let loadedFolders = new Set<string>();
  $effect(() => {
    const current = new Set(folders.map((folder) => folder.root));
    const added = [...current].filter((root) => !loadedFolders.has(root));
    const removed = [...loadedFolders].filter((root) => !current.has(root));
    loadedFolders = current;
    if (removed.length > 0) {
      const isRemoved = (path: string) => removed.some((root) => path === root || path.startsWith(`${root}/`));
      children = new Map([...children].filter(([path]) => !isRemoved(path)));
      expanded = new Set([...expanded].filter((path) => !isRemoved(path)));
    }
    if (added.length > 0) {
      expanded = new Set([...expanded, ...added]);
      for (const root of added) {
        void loadDir(root);
      }
    }
    if (current.size === 0) {
      selectedPath = null;
    }
  });

  // Follow the file opened in the editor tab.
  $effect(() => {
    const openPath = repoStore.openFilePath;
    if (openPath) {
      selectedPath = openPath;
    }
  });

  // Repository events refresh status; reload the folders currently shown.
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void repoStore.statuses;
    void repoStore.workspaceVersion;
    void repoStore.repos;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshLoaded(), 250);
    return () => clearTimeout(refreshTimer);
  });

  async function loadDir(dirPath: string): Promise<void> {
    const folder = folderFor(folders, dirPath);
    if (!folder) {
      return;
    }
    try {
      const listing = await api.listDirectory(folder.root, relativeTo(folder.root, dirPath), repoRoots);
      if (!folderFor(repoStore.workspace?.folders ?? [], dirPath)) {
        return;
      }
      const entries: TreeEntry[] = listing.entries.map((entry) => ({
        ...entry,
        path: joinPath(folder.root, entry.path),
        deleted: false,
        isFolderRoot: false,
      }));
      children = new Map(children).set(dirPath, entries);
      const nextTruncated = new Set(truncated);
      if (listing.truncated) {
        nextTruncated.add(dirPath);
      } else {
        nextTruncated.delete(dirPath);
      }
      truncated = nextTruncated;
      if (dirPath === folder.root && rootErrors.has(dirPath)) {
        const nextErrors = new Map(rootErrors);
        nextErrors.delete(dirPath);
        rootErrors = nextErrors;
      }
    } catch (error) {
      if (dirPath === folder.root) {
        rootErrors = new Map(rootErrors).set(dirPath, errorMessage(error));
        return;
      }
      // The directory disappeared: forget it.
      const next = new Map(children);
      next.delete(dirPath);
      children = next;
      const nextExpanded = new Set(expanded);
      nextExpanded.delete(dirPath);
      expanded = nextExpanded;
    }
  }

  async function refreshLoaded(): Promise<void> {
    const roots = new Set(folders.map((folder) => folder.root));
    const shown = [...children.keys()].filter((dirPath) => roots.has(dirPath) || expanded.has(dirPath));
    await Promise.all(shown.map((dirPath) => loadDir(dirPath)));
  }

  function toggle(dirPath: string): void {
    if (expanded.has(dirPath)) {
      collapse(dirPath);
      return;
    }
    expanded = new Set(expanded).add(dirPath);
    void loadDir(dirPath);
  }

  /** Collapsing also drops loaded contents below it, keeping memory flat. */
  function collapse(dirPath: string): void {
    const prefix = `${dirPath}/`;
    const isRoot = folders.some((folder) => folder.root === dirPath);
    expanded = new Set([...expanded].filter((path) => path !== dirPath && !path.startsWith(prefix)));
    const next = new Map(children);
    for (const key of next.keys()) {
      // A workspace folder keeps its own listing so reopening it is instant.
      if ((key === dirPath && !isRoot) || key.startsWith(prefix)) {
        next.delete(key);
      }
    }
    children = next;
  }

  function collapseAll(): void {
    const roots = new Set(folders.map((folder) => folder.root));
    expanded = multiRoot ? new Set() : new Set(roots);
    children = new Map([...children].filter(([path]) => roots.has(path)));
  }

  function activate(row: Row): void {
    selectedPath = row.entry.path;
    if (row.entry.deleted) {
      toast.info(`${row.entry.name} was deleted`, "Restore or stage the deletion from the Changes view.");
      return;
    }
    if (row.entry.isDir) {
      toggle(row.entry.path);
    } else {
      void repoStore.openFile(row.entry.path);
    }
  }

  function scrollIntoView(index: number): void {
    if (!listEl) {
      return;
    }
    const top = index * ROW_HEIGHT;
    if (top < listEl.scrollTop) {
      listEl.scrollTop = top;
    } else if (top + ROW_HEIGHT > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = top + ROW_HEIGHT - listEl.clientHeight;
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (rows.length === 0) {
      return;
    }
    const index = Math.max(0, rows.findIndex((row) => row.entry.path === selectedPath));
    const row = rows[index];
    let next = index;
    if (event.key === "ArrowDown") {
      next = Math.min(rows.length - 1, index + 1);
    } else if (event.key === "ArrowUp") {
      next = Math.max(0, index - 1);
    } else if (event.key === "ArrowRight" && row.entry.isDir && !row.expanded) {
      toggle(row.entry.path);
    } else if (event.key === "ArrowLeft") {
      if (row.entry.isDir && row.expanded) {
        collapse(row.entry.path);
      } else {
        const parent = parentOf(row.entry.path);
        const parentIndex = rows.findIndex((candidate) => candidate.entry.path === parent);
        if (parentIndex >= 0) {
          next = parentIndex;
        }
      }
    } else if (event.key === "Enter") {
      activate(row);
    } else {
      return;
    }
    event.preventDefault();
    selectedPath = rows[next].entry.path;
    scrollIntoView(next);
  }

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function openMenu(event: MouseEvent, row: Row): void {
    selectedPath = row.entry.path;
    const absolute = row.entry.path;
    const folder = folderFor(folders, absolute);
    const relative = folder ? relativeTo(folder.root, absolute) : absolute;
    const location = locateAbsolute(repoStore.repos, absolute);
    const conflicted = tones.get(absolute) === "conflict";
    let items: MenuItem[];
    if (row.entry.deleted) {
      items = [{ label: "Show in Changes", action: () => settings.setLeftPanel("changes") }];
    } else if (row.entry.isDir) {
      items = [{ label: row.expanded ? "Collapse" : "Expand", action: () => toggle(absolute) }];
      if (row.entry.isRepo) {
        const isActive = repoStore.repo?.root === absolute;
        items.push({
          label: isActive ? "Active Repository" : "Set as Active Repository",
          disabled: isActive,
          action: () => void repoStore.setActiveRepo(absolute),
        });
      } else if (!location) {
        items.push({ label: "Initialize Repository Here", action: () => void repoStore.initRepository(absolute) });
      }
      if (row.entry.isFolderRoot) {
        items.push(
          { separator: true },
          { label: "Add Folder to Workspace...", action: () => void pickAndAddFolder() },
          { label: "Remove Folder from Workspace", action: () => void repoStore.removeFolder(absolute) },
        );
      }
    } else {
      items = [
        { label: "Open", action: () => void repoStore.openFile(absolute, { pin: true }) },
        { label: "Open Preview", action: () => void repoStore.openFile(absolute) },
      ];
      if (conflicted && location) {
        items.push({
          label: "Resolve Conflict...",
          action: () => void repoStore.openMerge(location.repoPath, location.repo.root),
        });
      }
    }
    items.push(
      { separator: true },
      { label: "Copy Path", action: () => void copy(absolute) },
      { label: "Copy Relative Path", disabled: relative === "", action: () => void copy(relative) },
    );
    contextMenu.open(event, items);
  }

  function toneClass(entry: TreeEntry): FileTone | "ignored" | "" {
    if (entry.deleted) {
      return "deleted";
    }
    if (entry.ignored) {
      return "ignored";
    }
    return tones.get(entry.path) ?? "";
  }
</script>

<div class="explorer">
  <div class="head">
    <span class="title truncate" title={folders.map((folder) => folder.root).join("\n")}>
      {repoStore.workspace?.name ?? "Files"}
    </span>
    <div class="spacer"></div>
    <button class="icon-btn small" onclick={() => void pickAndAddFolder()} title="Add Folder to Workspace..." aria-label="Add folder to workspace">
      <Icon name="plus" size={14} />
    </button>
    <button class="icon-btn small" onclick={collapseAll} title="Collapse all" aria-label="Collapse all">
      <Icon name="chevron-up" size={14} />
    </button>
    <button class="icon-btn small" onclick={() => void refreshLoaded()} title="Refresh" aria-label="Refresh">
      <Icon name="refresh" size={13} />
    </button>
    <button class="icon-btn small" onclick={() => settings.toggleExplorer()} title="Hide files" aria-label="Hide files">
      <Icon name="x" size={14} />
    </button>
  </div>

  {#if singleRootError}
    <div class="message dim selectable">{singleRootError}</div>
  {:else if rows.length === 0 && !multiRoot && folders[0] && children.has(folders[0].root)}
    <div class="message dim">This folder is empty.</div>
  {:else}
    <div
      class="list"
      bind:this={listEl}
      bind:clientHeight={viewportHeight}
      onscroll={() => (scrollTop = listEl?.scrollTop ?? 0)}
      onkeydown={onKeydown}
      tabindex="0"
      role="tree"
      aria-label="Files"
    >
      <div class="spacer-rows" style="height: {rows.length * ROW_HEIGHT}px">
        {#each visibleRows as row, offset (row.entry.path)}
          <div
            class="row {toneClass(row.entry)}"
            class:repo={row.entry.isRepo}
            class:folder-root={row.entry.isFolderRoot}
            class:selected={row.entry.path === selectedPath}
            class:open={row.entry.path === repoStore.openFilePath}
            style="top: {(firstVisible + offset) * ROW_HEIGHT}px; padding-left: {8 + row.depth * 14}px"
            role="treeitem"
            aria-selected={row.entry.path === selectedPath}
            aria-expanded={row.entry.isDir ? row.expanded : undefined}
            tabindex="-1"
            title={row.entry.path}
            onclick={() => activate(row)}
            ondblclick={() => {
              if (!row.entry.isDir && !row.entry.deleted) {
                void repoStore.openFile(row.entry.path, { pin: true });
              }
            }}
            oncontextmenu={(event) => openMenu(event, row)}
            onkeydown={() => undefined}
          >
            <span class="chevron">
              {#if row.entry.isDir}
                <Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={12} />
              {/if}
            </span>
            <span class="icon">
              <Icon name={row.entry.isRepo ? "folder-git" : row.entry.isDir ? "folder" : "file"} size={14} />
            </span>
            <span class="name truncate">{row.entry.name}</span>
            {#if row.entry.isRepo}
              {@const branch = branchOf(row.entry.path)}
              {#if branch}
                <span class="branch truncate" title="Repository on branch {branch}">{branch}</span>
              {/if}
            {/if}
            {#if row.entry.isDir && truncated.has(row.entry.path)}
              <span class="dim more" title="Only the first 5000 entries are shown">5000+</span>
            {/if}
            {#if row.entry.isDir}
              {@const folderTone = tones.get(row.entry.path)}
              {#if folderTone}
                <span class="dot {folderTone}" title="Contains changes"></span>
              {/if}
            {:else}
              {@const mark = marks.get(row.entry.path)}
              {#if mark}
                <span class="letter {mark.tone}" title={mark.title}>{mark.letter}</span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 34px;
    padding: 0 6px 0 12px;
    border-bottom: 1px solid var(--border-strong);
  }

  .title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .spacer {
    flex: 1;
  }

  .icon-btn.small {
    height: 24px;
    min-width: 24px;
  }

  .message {
    padding: 14px 12px;
    font-size: 12px;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    outline: none;
    padding: 4px 0;
  }

  .spacer-rows {
    position: relative;
  }

  .row {
    position: absolute;
    left: 0;
    right: 0;
    height: 24px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 8px;
    cursor: default;
    white-space: nowrap;
  }

  .row:hover {
    background: var(--hover);
  }

  .row.open {
    background: var(--selected-inactive);
  }

  .row.selected {
    background: var(--selected-inactive);
  }

  .list:focus-within .row.selected {
    background: var(--selected);
  }

  .chevron {
    flex: none;
    width: 12px;
    color: var(--text-dim);
  }

  .icon {
    flex: none;
    color: var(--text-dim);
  }

  .row.repo .icon {
    color: var(--accent);
  }

  .row.repo .name {
    font-weight: 600;
  }

  /* Workspace folders in a multi-folder workspace, like VS Code's section headers. */
  .row.folder-root .name {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  .branch {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 45%;
    font-size: 11px;
    color: var(--text-dim);
  }

  .name {
    min-width: 0;
  }

  .more {
    margin-left: auto;
    font-size: 11px;
  }

  .row.modified .name {
    color: var(--accent);
  }

  .row.added .name {
    color: var(--success);
  }

  .row.conflict .name {
    color: var(--danger);
    font-weight: 500;
  }

  .row.deleted .name {
    color: var(--danger);
    text-decoration: line-through;
    opacity: 0.85;
  }

  .letter {
    flex: none;
    margin-left: auto;
    width: 16px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
  }

  .dot {
    flex: none;
    margin-left: auto;
    margin-right: 5px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .letter.modified {
    color: var(--accent);
  }

  .letter.added {
    color: var(--success);
  }

  .letter.deleted,
  .letter.conflict {
    color: var(--danger);
  }

  .dot.modified {
    background: var(--accent);
  }

  .dot.added {
    background: var(--success);
  }

  .dot.deleted,
  .dot.conflict {
    background: var(--danger);
  }

  .more + .dot,
  .more + .letter {
    margin-left: 6px;
  }

  .row.ignored .name,
  .row.ignored .icon {
    color: var(--text-faint);
  }
</style>
