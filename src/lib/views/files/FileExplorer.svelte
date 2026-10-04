<!-- Right sidebar: the work tree, loaded one folder at a time. -->
<script lang="ts">
  import { localHistory } from "$lib/localHistory/localHistory.svelte";
  import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { onMount, tick, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { compareStore } from "$lib/compare/compareStore.svelte";
  import { formatKeys } from "$lib/help/shortcuts";
  import { platformFromUserAgent } from "$lib/menu/menuSpec";
  import { terminalKeyAt } from "$lib/terminal/dropPaths";
  import { isPseudoTab } from "$lib/stores/pseudoTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import {
    baseName,
    folderFor,
    isInside,
    joinPath,
    locateAbsolute,
    movedPath,
    parentOf,
    type PathMove,
    relativeTo,
  } from "$lib/stores/workspacePaths";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import FileTypeIcon from "$lib/fileIcons/FileTypeIcon.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { platformName } from "$lib/update/releases";
  import { pickAndAddFolder } from "../repoPicker";
  import { ignoreMenu } from "$lib/ignore/ignoreActions";
  import { centeredScrollTop, foldersToOpen } from "./locate";
  import { revealLabel, terminalFolderFor } from "./reveal";
  import { type FileTone, type RepoTones, repoTones, workspaceTones } from "./tones";
  import { lfsStore } from "../git/lfs/lfsStore.svelte";
  import {
    autoScrollStep,
    checkDrop,
    dragLabel,
    dropFolder,
    dropPointToCss,
    type DropMode,
    HOVER_EXPAND_MS,
    pastDragThreshold,
  } from "./dragDrop";
  import { fileClipboard } from "./fileClipboard.svelte";
  import { applyAnswers, type FolderAnswer, groupByFolder, knownStamps, type TreeEntry } from "./folderListings";
  import { nameProblem, renameSelection } from "./fileNames";
  import {
    FILE_OP_LABELS,
    fileKeyOp,
    fileOpAccelerator,
    fileOpGroups,
    type FileOp,
    type FileOpTarget,
    movableTargets,
    targetFolder,
  } from "./fileOps";
  import {
    EMPTY_SELECTION,
    extendSelection,
    retargetSelection,
    rowAfterRemoval,
    selectAll,
    selectedInOrder,
    selectOnly,
    selectRange,
    toggleSelected,
    topLevel,
    type TreeSelection,
  } from "./selection";

  // Every path in the tree is absolute, so several workspace folders never collide.
  interface Row {
    entry: TreeEntry;
    depth: number;
    expanded: boolean;
  }

  /** A row drag in progress (pointer events, so it works however the window handles native drags). */
  interface RowDrag {
    sourcePaths: string[];
    names: string[];
    mode: DropMode;
    x: number;
    y: number;
  }

  const ROW_HEIGHT = 24;
  const REVEAL_LABEL = revealLabel(platformName(navigator.userAgent));
  const PLATFORM = platformFromUserAgent(navigator.userAgent);
  const OVERSCAN = 10;

  /** Loaded directory contents keyed by absolute directory path. */
  let children = $state.raw<Map<string, TreeEntry[]>>(new Map());
  let expanded = $state.raw<Set<string>>(new Set());
  let truncated = $state.raw<Set<string>>(new Set());
  let selection = $state.raw<TreeSelection>(EMPTY_SELECTION);
  let rootErrors = $state.raw<Map<string, string>>(new Map());
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let listEl = $state<HTMLDivElement | null>(null);
  let emptyEl = $state<HTMLDivElement | null>(null);
  /** The folder a drag would drop into, highlighted. */
  let dropDir = $state<string | null>(null);
  let drag = $state.raw<RowDrag | null>(null);

  const folders = $derived(repoStore.workspace?.folders ?? []);
  const multiRoot = $derived(folders.length > 1);
  /** The workspace folder that takes drops and new files off the rows; none with several folders. */
  const singleRoot = $derived(!multiRoot && folders[0] ? folders[0].root : null);

  /** Status tones, marks and deleted files of every repository; a repository whose status did not change is not redone. */
  const changes = $derived.by(() => {
    const perRepo: RepoTones[] = [];
    for (const repo of repoStore.repos) {
      const status = repoStore.statuses[repo.root];
      if (status) {
        perRepo.push(repoTones(status, repo.root));
      }
    }
    return workspaceTones(perRepo);
  });
  const repoRoots = $derived(repoStore.repos.map((repo) => repo.root));
  const repoRootSet = $derived(new Set(repoRoots));

  // LFS files for the "LFS" badges, checked again while the panel is open when HEAD, the index or entries change.
  $effect(() => {
    for (const repo of repoStore.repos) {
      lfsStore.follow(repo.root, repoStore.treeVersions[repo.root] ?? 0);
    }
    lfsStore.retain(repoRoots);
  });
  /** Absolute paths of the files stored in Git LFS. */
  const lfsPaths = $derived.by(() => {
    const paths = new Set<string>();
    for (const [repoRoot, status] of Object.entries(lfsStore.statuses)) {
      for (const filePath of status.files ?? []) {
        paths.add(joinPath(repoRoot, filePath));
      }
    }
    return paths;
  });

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
    const gone = changes.deletedIn(dirPath);
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
      // Each workspace folder is a top-level row.
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
  /** Visible paths, top down: the order Shift ranges and Shift+arrows follow. */
  const order = $derived(rows.map((row) => row.entry.path));
  const rowByPath = $derived(new Map(rows.map((row) => [row.entry.path, row])));
  const cutPaths = $derived(fileClipboard.mode === "cut" ? new Set(fileClipboard.paths) : null);

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
      void loadDirs(added);
    }
    if (current.size === 0) {
      selection = EMPTY_SELECTION;
    }
  });

  /** The file in the editor, when it is a real file inside the workspace. */
  const openedFile = $derived.by(() => {
    const openPath = repoStore.openFilePath;
    if (!openPath || isPseudoTab(openPath) || !folderFor(folders, openPath)) {
      return null;
    }
    return openPath;
  });

  // Follow the file opened in the editor tab, unless it is already part of the selection
  // (a tab that followed a rename or move keeps the moved rows selected).
  $effect(() => {
    const openPath = repoStore.openFilePath;
    if (openPath && !isPseudoTab(openPath)) {
      untrack(() => {
        if (!selection.paths.has(openPath)) {
          selection = selectOnly(openPath);
        }
      });
    }
  });

  // Entries came or went (or ignore rules changed): reload the folders currently shown.
  // Content edits and status changes never change a listing; tones and marks follow the statuses.
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void repoStore.listingVersion;
    void repoStore.repos;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshLoaded(), 250);
    return () => clearTimeout(refreshTimer);
  });

  /** Each loaded folder's stamp from its last listing: a refresh sends them, and unchanged folders are not read. */
  const stamps = new Map<string, string>();
  /** The latest request per folder, so an older answer never overwrites a newer one. */
  const requests = new Map<string, number>();
  let requestCount = 0;

  /** Lists folders (absolute paths) with one call per workspace folder and applies every answer at once. */
  async function loadDirs(dirPaths: Iterable<string>): Promise<void> {
    const groups = groupByFolder(dirPaths, (dirPath) => folderFor(folders, dirPath)?.root ?? null);
    if (groups.size === 0) {
      return;
    }
    const sent = new Map<string, number>();
    for (const group of groups.values()) {
      for (const dirPath of group) {
        requests.set(dirPath, ++requestCount);
        sent.set(dirPath, requestCount);
      }
    }
    const roots = repoRoots;
    const answers = await Promise.all(
      [...groups].map(async ([root, group]): Promise<FolderAnswer> => {
        const relative = group.map((dirPath) => relativeTo(root, dirPath));
        try {
          const listings = await api.listDirectories(root, relative, roots, knownStamps(root, group, stamps, children));
          return { root, dirPaths: group, listings, error: null };
        } catch (error) {
          return { root, dirPaths: group, listings: null, error: errorMessage(error) };
        }
      }),
    );
    const open = repoStore.workspace?.folders ?? [];
    const current = new Set<string>();
    for (const [dirPath, request] of sent) {
      if (requests.get(dirPath) === request) {
        requests.delete(dirPath);
        if (folderFor(open, dirPath)) {
          current.add(dirPath);
        }
      }
    }
    const next = applyAnswers({ children, expanded, truncated, rootErrors }, answers, stamps, (dirPath) => current.has(dirPath));
    children = next.children;
    expanded = next.expanded;
    truncated = next.truncated;
    rootErrors = next.rootErrors;
  }

  async function refreshLoaded(): Promise<void> {
    const roots = new Set(folders.map((folder) => folder.root));
    await loadDirs([...children.keys()].filter((dirPath) => roots.has(dirPath) || expanded.has(dirPath)));
  }

  function toggle(dirPath: string): void {
    if (expanded.has(dirPath)) {
      collapse(dirPath);
      return;
    }
    expanded = new Set(expanded).add(dirPath);
    void loadDirs([dirPath]);
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
    selection = selectOnly(row.entry.path);
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

  /** A click: Cmd-click (Ctrl-click elsewhere) toggles a row, Shift-click selects a range, a plain click opens. */
  function onRowClick(event: MouseEvent, row: Row): void {
    // The click that ends a drag is not a click on the row.
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (event.shiftKey) {
      selection = selectRange(selection, order, row.entry.path);
      return;
    }
    if (PLATFORM === "macos" ? event.metaKey : event.ctrlKey) {
      selection = toggleSelected(selection, row.entry.path);
      return;
    }
    activate(row);
  }

  /** Opens the folders down to the file in the editor, selects it and scrolls to it. */
  async function selectOpenedFile(): Promise<void> {
    const filePath = openedFile;
    const folder = filePath ? folderFor(folders, filePath) : null;
    if (!filePath || !folder) {
      return;
    }
    const dirPaths = foldersToOpen(folder.root, filePath);
    expanded = new Set([...expanded, ...dirPaths]);
    await loadDirs(dirPaths.filter((dirPath) => !children.has(dirPath)));
    selection = selectOnly(filePath);
    // Wait for the list to grow, or the new scroll position would be cut short.
    await tick();
    const index = rows.findIndex((row) => row.entry.path === filePath);
    if (index < 0) {
      const reason = truncated.has(parentOf(filePath))
        ? "Its folder has more than 5000 entries, and only the first 5000 are shown."
        : "Its folder could not be read.";
      toast.info(`${baseName(filePath)} is not in the list`, reason);
      return;
    }
    if (listEl) {
      const target = centeredScrollTop(index, ROW_HEIGHT, listEl.scrollTop, listEl.clientHeight);
      if (target !== null) {
        listEl.scrollTop = target;
      }
      listEl.focus();
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

  /** The selected rows that are visible, top down. */
  function selectedEntries(): TreeEntry[] {
    return selectedInOrder(selection, order)
      .map((path) => rowByPath.get(path)?.entry)
      .filter((entry) => entry !== undefined);
  }

  function focusedEntry(): TreeEntry | null {
    return selection.focus === null ? null : (rowByPath.get(selection.focus)?.entry ?? null);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (drag) {
      return;
    }
    const op = fileKeyOp(event, PLATFORM);
    if (op === "clearCut") {
      if (fileClipboard.mode === "cut") {
        event.preventDefault();
        fileClipboard.clear();
      }
      return;
    }
    if (op) {
      // The Edit menu has Cut, Copy and Paste too; preventing the default keeps it from running as well.
      event.preventDefault();
      const focused = focusedEntry();
      if (op === "paste") {
        void runOp("paste", focused ? [focused] : []);
      } else if (op === "rename") {
        void runOp("rename", focused ? [focused] : []);
      } else {
        void runOp(op, selectedEntries());
      }
      return;
    }
    if (rows.length === 0) {
      return;
    }
    const index = Math.max(0, rows.findIndex((row) => row.entry.path === selection.focus));
    const row = rows[index];
    const modified = event.metaKey || event.ctrlKey || event.altKey;
    if (event.shiftKey && !modified && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      selection = extendSelection(selection, order, event.key === "ArrowDown" ? 1 : -1);
      scrollIntoView(Math.max(0, order.indexOf(selection.focus ?? "")));
      return;
    }
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
    selection = selectOnly(rows[next].entry.path);
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

  async function reveal(absolutePath: string): Promise<void> {
    try {
      await revealItemInDir(absolutePath);
    } catch (error) {
      toast.error(`${REVEAL_LABEL} failed`, errorMessage(error));
    }
  }

  // File operations. The backend refuses anything outside the workspace folders, so every
  // call passes them; results come back as absolute paths.

  function workspaceRoots(): string[] {
    return folders.map((folder) => folder.root);
  }

  /** A folder as messages name it: its path inside the workspace folder, or the folder's name. */
  function folderLabel(dirPath: string): string {
    const folder = folderFor(folders, dirPath);
    if (!folder) {
      return baseName(dirPath);
    }
    return relativeTo(folder.root, dirPath) || folder.name;
  }

  function namesIn(dirPath: string): Set<string> {
    return new Set((children.get(dirPath) ?? []).map((entry) => entry.name));
  }

  /** "a.ts, b.ts and 3 more" for messages about many entries. */
  function listNames(paths: string[]): string {
    const names = paths.slice(0, 5).map((path) => baseName(path));
    return paths.length > 5 ? `${names.join(", ")} and ${paths.length - 5} more` : names.join(", ");
  }

  async function reloadDirs(dirPaths: string[]): Promise<void> {
    await loadDirs(dirPaths.filter((dirPath) => children.has(dirPath) || expanded.has(dirPath)));
  }

  /** After a write: reload the touched folders now, and let git and the open tabs catch up. */
  async function afterWrite(changedPaths: string[], dirPaths: string[]): Promise<void> {
    await reloadDirs(dirPaths);
    void repoStore.filesWritten(changedPaths);
  }

  /** Opens the folders down to `entryPaths` (and `alsoOpen`), selects the entries and scrolls to the last one. */
  async function showEntries(entryPaths: string[], alsoOpen: string[] = []): Promise<void> {
    const dirPaths = new Set<string>(alsoOpen);
    for (const entryPath of entryPaths) {
      const folder = folderFor(folders, entryPath);
      for (const dirPath of folder ? foldersToOpen(folder.root, entryPath) : []) {
        dirPaths.add(dirPath);
      }
    }
    expanded = new Set([...expanded, ...dirPaths]);
    await loadDirs(dirPaths);
    selection = selectAll(entryPaths);
    await tick();
    const index = order.indexOf(entryPaths[entryPaths.length - 1] ?? "");
    if (index >= 0) {
      scrollIntoView(index);
    }
    listEl?.focus();
  }

  /** Renames and moves: tabs, the clipboard, open folders and the selection follow the new paths. */
  function applyMoves(moves: PathMove[]): void {
    if (moves.length === 0) {
      return;
    }
    repoStore.retargetTabs(moves);
    fileClipboard.follow(moves);
    const isMoved = (path: string) => moves.some((move) => isInside(move.from, path));
    const reopened = [...expanded].filter(isMoved).map((path) => movedPath(path, moves));
    expanded = new Set([...[...expanded].filter((path) => !isMoved(path)), ...reopened]);
    // Listings under the old paths are stale; open folders load again under their new paths.
    children = new Map([...children].filter(([path]) => !isMoved(path)));
    selection = retargetSelection(selection, moves);
    void loadDirs(reopened);
  }

  async function createEntry(parentDir: string, isDir: boolean): Promise<void> {
    const taken = namesIn(parentDir);
    const label = folderLabel(parentDir);
    const result = await dialogs.prompt({
      title: isDir ? "New Folder" : "New File",
      label: `In ${label}`,
      placeholder: isDir ? "Folder name, or a/b for nested folders" : "File name, or folder/file.ts",
      confirmLabel: "Create",
      validate: (value) => nameProblem(value, { nested: true, taken, folderLabel: label, ignoreCase: PLATFORM !== "linux" }),
    });
    if (!result) {
      listEl?.focus();
      return;
    }
    let created: string;
    try {
      created = await api.fileCreate(workspaceRoots(), parentDir, result.value, isDir);
    } catch (error) {
      toast.error(isDir ? "Could not create the folder" : "Could not create the file", errorMessage(error));
      return;
    }
    await showEntries([created], isDir ? [created] : []);
    void repoStore.filesWritten([created]);
    if (!isDir) {
      await repoStore.openFile(created, { pin: true });
    }
  }

  async function renameEntry(target: FileOpTarget): Promise<void> {
    if (target.isFolderRoot || target.deleted || !repoStore.checkUnsaved([target.path])) {
      return;
    }
    const name = baseName(target.path);
    const parentDir = parentOf(target.path);
    const taken = namesIn(parentDir);
    const label = folderLabel(parentDir);
    const result = await dialogs.prompt({
      title: target.isDir ? "Rename Folder" : "Rename File",
      label: "New name",
      initial: name,
      selection: renameSelection(name, target.isDir),
      confirmLabel: "Rename",
      validate: (value) =>
        nameProblem(value, { nested: false, taken, folderLabel: label, current: name, ignoreCase: PLATFORM !== "linux" }),
    });
    if (!result || result.value === name) {
      listEl?.focus();
      return;
    }
    try {
      const renamed = await api.fileRename(workspaceRoots(), target.path, result.value);
      applyMoves([{ from: target.path, to: renamed }]);
      await afterWrite([target.path, renamed], [parentDir]);
      listEl?.focus();
    } catch (error) {
      toast.error(`Could not rename ${name}`, errorMessage(error));
    }
  }

  /** Moves into `targetDir`; true when done or nothing had to move. `ask` is for drag and drop. */
  async function moveEntries(sourcePaths: string[], targetDir: string, ask: boolean): Promise<boolean> {
    const sources = topLevel(sourcePaths);
    const check = checkDrop(sources, targetDir, "move");
    if (check === "noop") {
      return true;
    }
    if (check === "intoItself") {
      toast.info("A folder cannot move into itself");
      return false;
    }
    if (!repoStore.checkUnsaved(sources)) {
      return false;
    }
    // Refuse a taken name before asking: the backend would refuse it after the question. The dry run checks the
    // folder on disk, so a closed folder is never listed for it.
    let clash: string | null;
    try {
      clash = await api.fileMoveClash(workspaceRoots(), sources, targetDir);
    } catch (error) {
      toast.error("Could not move", errorMessage(error));
      return false;
    }
    if (clash) {
      toast.error("Could not move", `${clash} already exists in ${folderLabel(targetDir)}`);
      return false;
    }
    if (ask && settings.confirmDragAndDrop) {
      const what = sources.length === 1 ? baseName(sources[0]) : `${sources.length} items`;
      const confirmed = await dialogs.confirm({
        title: "Move",
        message: `Move ${what} into ${folderLabel(targetDir)}?\n\nTurn this question off in Settings, Layout.`,
        confirmLabel: "Move",
      });
      if (!confirmed) {
        listEl?.focus();
        return false;
      }
    }
    let moves: PathMove[];
    try {
      moves = await api.fileMove(workspaceRoots(), sources, targetDir);
    } catch (error) {
      toast.error("Could not move", errorMessage(error));
      return false;
    }
    if (moves.length === 0) {
      return true;
    }
    applyMoves(moves);
    await showEntries(moves.map((move) => move.to));
    await afterWrite(
      moves.flatMap((move) => [move.from, move.to]),
      sources.map((sourcePath) => parentOf(sourcePath)),
    );
    return true;
  }

  async function copyEntries(sourcePaths: string[], targetDir: string): Promise<void> {
    const sources = topLevel(sourcePaths);
    if (checkDrop(sources, targetDir, "copy") === "intoItself") {
      toast.info("A folder cannot be copied into itself");
      return;
    }
    let created: string[];
    try {
      created = await api.fileCopy(workspaceRoots(), sources, targetDir);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
      return;
    }
    if (created.length === 0) {
      return;
    }
    await showEntries(created);
    void repoStore.filesWritten(created);
  }

  /** Copies each entry next to itself ("cart copy.ts"). */
  async function duplicate(targets: FileOpTarget[]): Promise<void> {
    const byParent = new Map<string, string[]>();
    for (const sourcePath of topLevel(movableTargets(targets).map((target) => target.path))) {
      byParent.set(parentOf(sourcePath), [...(byParent.get(parentOf(sourcePath)) ?? []), sourcePath]);
    }
    const created: string[] = [];
    try {
      for (const [parentDir, sources] of byParent) {
        created.push(...(await api.fileCopy(workspaceRoots(), sources, parentDir)));
      }
    } catch (error) {
      toast.error("Could not duplicate", errorMessage(error));
    }
    if (created.length > 0) {
      await showEntries(created);
      void repoStore.filesWritten(created);
    }
  }

  async function paste(targetDir: string | null): Promise<void> {
    if (!targetDir) {
      return;
    }
    const sources = fileClipboard.paths.filter((path) => folderFor(folders, path) !== null);
    if (sources.length === 0) {
      fileClipboard.clear();
      return;
    }
    if (fileClipboard.mode === "cut") {
      if (await moveEntries(sources, targetDir, false)) {
        fileClipboard.clear();
      }
    } else {
      await copyEntries(sources, targetDir);
    }
  }

  async function trashEntries(targets: FileOpTarget[]): Promise<void> {
    const movable = movableTargets(targets);
    const trashPaths = topLevel(movable.map((target) => target.path));
    if (trashPaths.length === 0 || !repoStore.checkUnsaved(trashPaths)) {
      return;
    }
    const folderInside = movable.some((target) => target.isDir && trashPaths.includes(target.path));
    const message =
      trashPaths.length === 1
        ? `Move ${baseName(trashPaths[0])} to the Trash?`
        : `Move ${trashPaths.length} items to the Trash? ${listNames(trashPaths)}.`;
    const confirmed = await dialogs.confirm({
      title: "Move to Trash",
      message: `${message}${folderInside ? " Everything inside goes too." : ""} You can put it back from the Trash.`,
      confirmLabel: "Move to Trash",
      danger: true,
    });
    if (!confirmed) {
      listEl?.focus();
      return;
    }
    const next = rowAfterRemoval(order, trashPaths);
    try {
      await api.fileTrash(workspaceRoots(), trashPaths);
    } catch (error) {
      toast.error("Move to Trash failed", errorMessage(error));
      return;
    }
    repoStore.closeTabsUnder(trashPaths);
    fileClipboard.forget(trashPaths);
    const isGone = (path: string) => trashPaths.some((trashPath) => isInside(trashPath, path));
    expanded = new Set([...expanded].filter((path) => !isGone(path)));
    children = new Map([...children].filter(([path]) => !isGone(path)));
    selection = selectOnly(next);
    await afterWrite(
      trashPaths,
      trashPaths.map((trashPath) => parentOf(trashPath)),
    );
    listEl?.focus();
  }

  function setClipboard(mode: "cut" | "copy", targets: FileOpTarget[]): void {
    const paths = topLevel(movableTargets(targets).map((target) => target.path));
    if (paths.length > 0) {
      fileClipboard.set(mode, paths);
    }
  }

  async function runOp(op: FileOp, targets: FileOpTarget[]): Promise<void> {
    const first = targets[0] ?? null;
    switch (op) {
      case "newFile":
      case "newFolder": {
        const parentDir = targetFolder(first, singleRoot);
        if (parentDir) {
          await createEntry(parentDir, op === "newFolder");
        }
        break;
      }
      case "cut":
      case "copy":
        setClipboard(op, targets);
        break;
      case "paste":
        await paste(targetFolder(first, singleRoot));
        break;
      case "duplicate":
        await duplicate(targets);
        break;
      case "rename":
        if (first && targets.length === 1) {
          await renameEntry(first);
        }
        break;
      case "trash":
        await trashEntries(targets);
        break;
      case "copyPaths":
        await copy(targets.map((target) => target.path).join("\n"));
        break;
    }
  }

  /** The file operation items for `targets`, each group after a separator. */
  function fileOpMenu(targets: FileOpTarget[]): MenuItem[] {
    const items: MenuItem[] = [];
    for (const group of fileOpGroups(targets, fileClipboard.paths.length > 0)) {
      items.push({ separator: true });
      for (const item of group) {
        const accelerator = fileOpAccelerator(item.op, PLATFORM);
        items.push({
          label: FILE_OP_LABELS[item.op],
          disabled: item.disabled,
          hint: accelerator ? formatKeys(accelerator, PLATFORM) : undefined,
          action: () => void runOp(item.op, targets),
        });
      }
    }
    return items;
  }

  function openMenu(event: MouseEvent, row: Row): void {
    const selected = selection.paths.has(row.entry.path) ? selectedEntries() : [];
    // Two selected files offer Compare Selected above the file operations (whose first item is a separator).
    const compareItems = selected.length > 1 ? compareStore.filesPanelItems(selected) : [];
    const multiItems = selected.length > 1 ? [...compareItems, ...fileOpMenu(selected).slice(compareItems.length > 0 ? 0 : 1)] : [];
    if (multiItems.length > 0) {
      contextMenu.open(event, multiItems);
      return;
    }
    selection = selectOnly(row.entry.path);
    const absolute = row.entry.path;
    const folder = folderFor(folders, absolute);
    const relative = folder ? relativeTo(folder.root, absolute) : absolute;
    const location = locateAbsolute(repoStore.repos, absolute);
    const conflicted = changes.tone(absolute) === "conflict";
    let items: MenuItem[];
    if (row.entry.deleted) {
      items = [{ label: "Show in Changes", action: () => settings.setLeftPanel("changes") }];
      if (!row.entry.isDir) {
        items.push({ label: "Show Local History", action: () => localHistory.openFile(absolute) });
      }
    } else if (row.entry.isDir) {
      items = [
        { label: row.expanded ? "Collapse" : "Expand", action: () => toggle(absolute) },
        { label: "Show Recently Deleted", action: () => localHistory.openDeleted([absolute]) },
      ];
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
        ...(settings.splitEditor
          ? [{ label: "Open to the Side", action: () => void repoStore.openFile(absolute, { pin: true, toSide: true }) }]
          : []),
        { label: "Show Local History", action: () => localHistory.openFile(absolute) },
      ];
      if (conflicted && location) {
        items.push({
          label: "Resolve Conflict...",
          action: () => void repoStore.openMerge(location.repoPath, location.repo.root),
        });
      }
      items.push({ separator: true }, ...compareStore.filesPanelItems([row.entry]));
    }
    items.push(...fileOpMenu([row.entry]));
    const ignoreItem = location && !row.entry.deleted ? ignoreMenu(location.repo.root, location.repoPath, row.entry.isDir) : null;
    if (ignoreItem) {
      items.push({ separator: true }, ignoreItem);
    }
    if (!row.entry.deleted) {
      items.push(
        { separator: true },
        { label: REVEAL_LABEL, action: () => void reveal(absolute) },
        {
          label: "Open in Integrated Terminal",
          action: () => void terminalStore.create({ folderPath: terminalFolderFor(absolute, row.entry.isDir) }),
        },
      );
    }
    items.push(
      { separator: true },
      { label: "Copy Path", action: () => void copy(absolute) },
      { label: "Copy Relative Path", disabled: relative === "", action: () => void copy(relative) },
    );
    contextMenu.open(event, items);
  }

  /** Right-click below the rows (or in an empty folder): new files and pastes go into the workspace folder. */
  function openBackgroundMenu(event: MouseEvent): void {
    if (!singleRoot) {
      return;
    }
    selection = EMPTY_SELECTION;
    contextMenu.open(event, fileOpMenu([{ path: singleRoot, isDir: true, isFolderRoot: true, deleted: false }]).slice(1));
  }

  function toneClass(entry: TreeEntry): FileTone | "ignored" | "" {
    if (entry.deleted) {
      return "deleted";
    }
    if (entry.ignored) {
      return "ignored";
    }
    return changes.tone(entry.path) ?? "";
  }

  // Drag and drop. Rows drag with pointer events: a press that moves a few pixels becomes a
  // drag, Option (Alt) makes it a copy. Files from the Finder arrive through Tauri's
  // drag-drop events and are copied in. Both share the drop target, hover-expand and
  // auto-scroll below; listeners and the frame loop live only while a drag does.

  let pendingDrag: { row: Row; x: number; y: number } | null = null;
  /** Set when a drag ends, so the click the browser sends after the mouseup is ignored. */
  let suppressClick = false;
  let hoverPath: string | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  /** Pointer position for the auto-scroll loop, in CSS px; null while nothing is dragged over the list. */
  let pointer: { x: number; y: number } | null = null;
  /** Sources and mode of the drag the loop updates the target for. */
  let pointerDrag: { sourcePaths: string[]; mode: DropMode } | null = null;
  let scrollFrame = 0;
  /** Paths of the Finder drag over the window, from its "enter" event. */
  let finderPaths: string[] | null = null;

  interface Hit {
    /** Over the list (or the empty folder message), not the header or another panel. */
    inside: boolean;
    row: Row | null;
  }

  function hitTest(x: number, y: number): Hit {
    const element = document.elementFromPoint(x, y);
    if (!element || !(listEl?.contains(element) || emptyEl?.contains(element))) {
      return { inside: false, row: null };
    }
    const rowEl = element.closest<HTMLElement>("[data-path]");
    return { inside: true, row: rowEl ? (rowByPath.get(rowEl.dataset.path ?? "") ?? null) : null };
  }

  /** Highlights the folder a drop would go into, or nothing when the drop cannot happen there. */
  function updateTarget(x: number, y: number, sourcePaths: string[], mode: DropMode): void {
    const hit = hitTest(x, y);
    const targetDir = hit.inside ? dropFolder(hit.row?.entry ?? null, singleRoot) : null;
    dropDir = targetDir && checkDrop(sourcePaths, targetDir, mode) === "ok" ? targetDir : null;
    hoverFolder(hit.row && hit.row.entry.isDir && !hit.row.expanded ? hit.row.entry.path : null);
  }

  /** A closed folder under the pointer opens after a moment. */
  function hoverFolder(dirPath: string | null): void {
    if (dirPath === hoverPath) {
      return;
    }
    hoverPath = dirPath;
    clearTimeout(hoverTimer);
    if (dirPath) {
      hoverTimer = setTimeout(() => {
        if (hoverPath === dirPath && !expanded.has(dirPath)) {
          expanded = new Set(expanded).add(dirPath);
          void loadDirs([dirPath]);
        }
      }, HOVER_EXPAND_MS);
    }
  }

  /** Runs every frame while something is dragged over the list: scrolls near the edges and keeps the target current. */
  function autoScrollFrame(): void {
    scrollFrame = 0;
    if (!pointer || !pointerDrag) {
      return;
    }
    updateTarget(pointer.x, pointer.y, pointerDrag.sourcePaths, pointerDrag.mode);
    if (listEl) {
      const rect = listEl.getBoundingClientRect();
      const step = pointer.x >= rect.left && pointer.x <= rect.right ? autoScrollStep(pointer.y, rect.top, rect.bottom) : 0;
      if (step !== 0) {
        listEl.scrollTop += step;
      }
    }
    scrollFrame = requestAnimationFrame(autoScrollFrame);
  }

  function trackPointer(x: number, y: number, sourcePaths: string[], mode: DropMode): void {
    pointer = { x, y };
    pointerDrag = { sourcePaths, mode };
    updateTarget(x, y, sourcePaths, mode);
    if (!scrollFrame) {
      scrollFrame = requestAnimationFrame(autoScrollFrame);
    }
  }

  function clearDropFeedback(): void {
    pointer = null;
    pointerDrag = null;
    dropDir = null;
    hoverFolder(null);
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }

  function onRowMouseDown(event: MouseEvent, row: Row): void {
    suppressClick = false;
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || row.entry.deleted || row.entry.isFolderRoot) {
      return;
    }
    pendingDrag = { row, x: event.clientX, y: event.clientY };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
    window.addEventListener("keydown", onDragKey, true);
    window.addEventListener("keyup", onDragKey, true);
  }

  function startDrag(row: Row, x: number, y: number): void {
    let sourcePaths = [row.entry.path];
    if (selection.paths.has(row.entry.path)) {
      const selected = topLevel(movableTargets(selectedEntries()).map((entry) => entry.path));
      if (selected.length > 0) {
        sourcePaths = selected;
      }
    } else {
      selection = selectOnly(row.entry.path);
    }
    drag = { sourcePaths, names: sourcePaths.map((sourcePath) => baseName(sourcePath)), mode: "move", x, y };
  }

  function moveDrag(x: number, y: number, copyMode: boolean): void {
    if (!drag) {
      return;
    }
    const mode: DropMode = copyMode ? "copy" : "move";
    drag = { ...drag, mode, x, y };
    trackPointer(x, y, drag.sourcePaths, mode);
  }

  function onDragMove(event: MouseEvent): void {
    if (!drag) {
      const pending = pendingDrag;
      if (!pending || !pastDragThreshold(pending, { x: event.clientX, y: event.clientY })) {
        return;
      }
      startDrag(pending.row, event.clientX, event.clientY);
    }
    moveDrag(event.clientX, event.clientY, event.altKey);
  }

  function onDragEnd(event: MouseEvent): void {
    const finished = drag;
    const targetDir = dropDir;
    stopDrag();
    if (!finished) {
      return;
    }
    suppressClick = true;
    if (!targetDir) {
      return;
    }
    if (event.altKey) {
      void copyEntries(finished.sourcePaths, targetDir);
    } else {
      void moveEntries(finished.sourcePaths, targetDir, true);
    }
  }

  /** Escape cancels a drag; pressing or releasing Option switches between move and copy. */
  function onDragKey(event: KeyboardEvent): void {
    if (!drag) {
      return;
    }
    if (event.type === "keydown" && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stopDrag();
      suppressClick = true;
    } else if (event.key === "Alt") {
      moveDrag(drag.x, drag.y, event.type === "keydown");
    }
  }

  function stopDrag(): void {
    pendingDrag = null;
    drag = null;
    clearDropFeedback();
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
    window.removeEventListener("keydown", onDragKey, true);
    window.removeEventListener("keyup", onDragKey, true);
  }

  function onFinderDrag(event: DragDropEvent): void {
    if (event.type === "leave") {
      finderPaths = null;
      clearDropFeedback();
      return;
    }
    if (event.type === "enter") {
      finderPaths = event.paths;
    }
    const point = dropPointToCss(event.position, window.devicePixelRatio, PLATFORM);
    // A terminal takes drops over it (TerminalHost), so the same drop never lands twice.
    if (terminalKeyAt(document.elementFromPoint(point.x, point.y)) !== null) {
      if (event.type === "drop") {
        finderPaths = null;
      }
      clearDropFeedback();
      return;
    }
    const paths = event.type === "over" ? (finderPaths ?? []) : event.paths;
    if (event.type === "drop") {
      const hit = hitTest(point.x, point.y);
      const targetDir = hit.inside ? dropFolder(hit.row?.entry ?? null, singleRoot) : null;
      finderPaths = null;
      clearDropFeedback();
      if (targetDir && paths.length > 0) {
        void copyEntries(paths, targetDir);
      }
      return;
    }
    if (paths.length === 0 || !hitTest(point.x, point.y).inside) {
      clearDropFeedback();
      return;
    }
    trackPointer(point.x, point.y, paths, "copy");
  }

  onMount(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    try {
      void getCurrentWebview()
        .onDragDropEvent((event) => onFinderDrag(event.payload))
        .then((off) => {
          if (disposed) {
            off();
          } else {
            unlisten = off;
          }
        })
        .catch(() => undefined);
    } catch {
      // Not inside Tauri (the screenshot bridge): there are no Finder drops to take.
    }
    return () => {
      disposed = true;
      unlisten?.();
      stopDrag();
      clearTimeout(hoverTimer);
    };
  });
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
    <button
      class="icon-btn small"
      onclick={() => void selectOpenedFile()}
      disabled={!openedFile}
      title={openedFile ? "Select Opened File" : "Select Opened File (open a file first)"}
      aria-label="Select opened file"
    >
      <Icon name="locate" size={14} />
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
    <div
      class="message dim empty"
      class:drop-root={dropDir !== null && dropDir === singleRoot}
      bind:this={emptyEl}
      oncontextmenu={openBackgroundMenu}
      role="presentation"
    >
      This folder is empty.
    </div>
  {:else}
    <div
      class="list"
      class:drop-root={dropDir !== null && dropDir === singleRoot}
      class:dragging={drag !== null}
      bind:this={listEl}
      bind:clientHeight={viewportHeight}
      onscroll={() => (scrollTop = listEl?.scrollTop ?? 0)}
      onkeydown={onKeydown}
      oncontextmenu={openBackgroundMenu}
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
            class:selected={selection.paths.has(row.entry.path)}
            class:open={row.entry.path === repoStore.openFilePath}
            class:cut={cutPaths?.has(row.entry.path) ?? false}
            class:drop-target={dropDir !== null && dropDir !== singleRoot && isInside(dropDir, row.entry.path)}
            style="top: {(firstVisible + offset) * ROW_HEIGHT}px; padding-left: {8 + row.depth * 14}px"
            role="treeitem"
            aria-selected={selection.paths.has(row.entry.path)}
            aria-expanded={row.entry.isDir ? row.expanded : undefined}
            tabindex="-1"
            title={row.entry.path}
            data-path={row.entry.path}
            onmousedown={(event) => onRowMouseDown(event, row)}
            onclick={(event) => onRowClick(event, row)}
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
              {#if row.entry.isDir}
                <Icon name={row.entry.isRepo ? "folder-git" : "folder"} size={14} />
              {:else}
                <FileTypeIcon fileName={row.entry.name} />
              {/if}
            </span>
            <span class="name truncate">{row.entry.name}</span>
            {#if row.entry.isRepo}
              {@const branch = branchOf(row.entry.path)}
              {#if branch}
                <span class="branch truncate" title="Repository on branch {branch}">{branch}</span>
              {/if}
            {/if}
            {#if !row.entry.isDir && lfsPaths.has(row.entry.path)}
              <span class="lfs-tag" title="Stored in Git LFS">LFS</span>
            {/if}
            {#if row.entry.isDir && truncated.has(row.entry.path)}
              <span class="dim more" title="Only the first 5000 entries are shown">5000+</span>
            {/if}
            {#if row.entry.isDir}
              {@const folderTone = changes.tone(row.entry.path)}
              {#if folderTone}
                <span class="dot {folderTone}" title="Contains changes"></span>
              {/if}
            {:else}
              {@const mark = changes.mark(row.entry.path)}
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

{#if drag}
  <div class="drag-ghost" style="left: {drag.x + 14}px; top: {drag.y + 10}px">{dragLabel(drag.names, drag.mode)}</div>
{/if}

<style>
  .lfs-tag {
    flex: none;
    padding: 0 4px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--text-dim);
    font-size: 9.5px;
    font-weight: 600;
    line-height: 13px;
  }

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

  /* A pending cut. */
  .row.cut .name,
  .row.cut .icon {
    opacity: 0.5;
  }

  /* The folder a drop goes into, and everything shown inside it. */
  .row.drop-target,
  .list:focus-within .row.drop-target {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .list.drop-root,
  .message.drop-root {
    box-shadow: inset 0 0 0 1px var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .list.dragging,
  .list.dragging .row {
    cursor: default;
  }

  .message.empty {
    flex: 1;
  }

  .drag-ghost {
    position: fixed;
    z-index: 1000;
    pointer-events: none;
    max-width: 260px;
    padding: 3px 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow);
    color: var(--text);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  /* Workspace folders in a multi-folder workspace, as section headers. */
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

  .row.ignored .icon :global(.file-type-icon),
  .row.ignored .icon :global(.file-type-image) {
    opacity: 0.5;
  }
</style>
