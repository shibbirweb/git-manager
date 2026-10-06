// Central state for the open workspace: a folder holding any number of git
// repositories (possibly none). One repository is "active" and drives the
// branches sidebar, the log, the header actions and the conflict banner;
// statuses are kept for every repository so changes can be shown per repo.
// Views call `run` / `runOp` for mutations so busy state, errors and
// refreshes are handled in one place.

import type { UnlistenFn } from "@tauri-apps/api/event";
import { api, errorMessage, onGitProgress, onOpenFilesChanged, onRepoChanged, onWorkspaceChanged } from "$lib/api";
import type { OpOutcome, Refs, RemoteInfo, RepoInfo, RepoStatus, StashEntry } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast, type ToastAction } from "$lib/ui/toast.svelte";
import { settings } from "./settings.svelte";
import { commitTabPath } from "./commitTabs";
import { baseName, openFailure, openingTitle } from "./openingProgress";
import { folderFor, locateAbsolute, type PathMove } from "./workspacePaths";
import { repoRefresh, treeChanged, WATCHER_FALLBACK_MS, workspaceRefresh, writeFallback } from "./refreshPlan";
import { isPseudoTab } from "./pseudoTabs";
import { type ClosedTab, popClosedTab, pushClosedTabs, reopenAt, updateClosedPosition } from "./closedTabs";
import {
  allTabs,
  applyEvictions,
  canSplitRight,
  closedBetween,
  closeGroup,
  closeInGroups,
  dropEmptyGroups,
  type EditorGroup,
  focusedGroup,
  focusGroup,
  groupById,
  groupEvictions,
  type GroupsState,
  type GroupTab,
  hasTab,
  initialGroups,
  mapGroups,
  mergeGroups,
  moveToOtherGroup,
  openInGroup,
  openTarget,
  restoredGroups,
  setDirtyEverywhere,
  sideOf,
  splitRight,
  updateGroup,
} from "./editorGroups";
import {
  restorableTabs,
  sameTabSession,
  type SavedTabGroup,
  sessionPaths,
  sessionWithKept,
  type TabPosition,
  tabSessionOf,
} from "./tabSession";
import { fileCommands } from "./fileCommands.svelte";
import { unsavedText } from "./unsavedText.svelte";
import { isUntitledTab, newUntitledPath, untitledTitle } from "./untitledTabs";
import { type TabSleepEntry, tabsToSleep } from "./tabSleep";
import { isTerminalTab } from "$lib/terminal/terminalTabs";
import {
  type FileTab,
  fileTabsUnder,
  moveTab,
  otherPaths,
  pathsToRight,
  pinnedFirst,
  pinTab,
  replaceTabPath,
  retargetTabs,
  setTabPinned,
  unpinnedPaths,
  tabsInFolder,
  type TabsState,
} from "./tabs";

/** "none" is the empty main area shown when the Log is toggled off and nothing else is open. */
export interface WorkspaceFolder {
  root: string;
  name: string;
  /** Repositories found in this folder (including one enclosing it). */
  repoRoots: string[];
}

/** One or more folders opened together as one workspace. */
export interface OpenWorkspace {
  /** Key for remembered state: the folder roots joined. */
  id: string;
  name: string;
  /** The first folder, used where a single folder is needed. */
  root: string;
  folders: WorkspaceFolder[];
  /** Saved workspace file this workspace belongs to; kept in sync when folders change. */
  file: string | null;
}

/** Recognized workspace file suffixes; the first is the one we save. */
export const WORKSPACE_FILE_SUFFIXES = [".gitmanager-workspace", ".code-workspace"];

export interface OpenOptions {
  /**
   * False when a window reopens what it showed (restored at start, or a reload): two restored
   * windows may share a folder, and neither should give it up to the other.
   */
  focusExisting?: boolean;
}

export function isWorkspaceFile(path: string): boolean {
  return WORKSPACE_FILE_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

function workspaceFileName(file: string): string {
  const base = file.slice(file.lastIndexOf("/") + 1);
  const suffix = WORKSPACE_FILE_SUFFIXES.find((candidate) => base.endsWith(candidate));
  return suffix ? base.slice(0, -suffix.length) : base;
}

function workspaceName(folders: WorkspaceFolder[]): string {
  if (folders.length <= 1) {
    return folders[0]?.name ?? "";
  }
  const names = folders.slice(0, 2).map((folder) => folder.name).join(", ");
  return folders.length > 2 ? `${names} +${folders.length - 2}` : names;
}

function describeWorkspace(folders: WorkspaceFolder[], file: string | null = null): OpenWorkspace {
  return {
    id: file ?? folders.map((folder) => folder.root).join("\n"),
    name: file ? workspaceFileName(file) : workspaceName(folders),
    root: folders[0]?.root ?? "",
    folders,
    file,
  };
}

/** Every repository of every folder, parents before children, without duplicates. */
function unionRepos(lists: RepoInfo[][]): RepoInfo[] {
  const byRoot = new Map<string, RepoInfo>();
  for (const list of lists) {
    for (const repo of list) {
      if (!byRoot.has(repo.root)) {
        byRoot.set(repo.root, repo);
      }
    }
  }
  return [...byRoot.values()].sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
}

export type MainView = "diff" | "log" | "file" | "none";

export interface CommitTabInfo {
  /** The commit subject, for the tab tooltip. */
  summary: string | null;
  /** The file to show; `token` changes on every request so the same file can be asked for again. */
  focus: { path: string; token: number } | null;
}

/** Wait after the last tab change (or caret move) before the open tabs are written to state.json. */
const TABS_SAVE_DELAY_MS = 1000;

/** File tabs count for the tab limit and the saved session; commit, history, branches and terminal tabs do not. */
function isFileTab(tabPath: string): boolean {
  return !isPseudoTab(tabPath);
}

/** The name a question about unsaved changes uses for a tab. */
function tabName(tab: FileTab): string {
  return isUntitledTab(tab.path) ? untitledTitle(fileCommands.text(tab.path) ?? "") : tab.path.slice(tab.path.lastIndexOf("/") + 1);
}

/** Key of a dormant tab: the same file can sleep in each editor group. */
function dormantKey(groupId: number, tabPath: string): string {
  return `${groupId}\n${tabPath}`;
}

/** Wait after the last `.git` appearing or disappearing before rescanning, so a clone is scanned once. */
const RESCAN_DELAY_MS = 1000;

interface RunOptions<T> {
  /** Toast shown on success; a function receives the result. */
  success?: string | ((result: T) => string | null);
  /** Refresh the repository afterwards (default true); "status" when the work only touches the index or files. */
  refresh?: boolean | "status";
  /** Repository to run in; defaults to the active one. */
  repoPath?: string;
  /** A button in the success toast, such as Undo; null for none. */
  action?: (result: T) => ToastAction | null;
}

class RepoStore {
  workspace = $state<OpenWorkspace | null>(null);
  /** Every repository in the workspace, parents before children. */
  repos = $state.raw<RepoInfo[]>([]);
  /** Latest status per repository root. */
  statuses = $state.raw<Record<string, RepoStatus>>({});
  /** The active repository, or null when the workspace has none. */
  repo = $state<RepoInfo | null>(null);
  refs = $state<Refs | null>(null);
  stashes = $state<StashEntry[]>([]);
  /** Remotes of the active repository with their URLs (Manage Remotes, the GitHub submenu). */
  remotes = $state.raw<RemoteInfo[]>([]);
  /** Label of the running operation, e.g. "Pushing". */
  busy = $state<string | null>(null);
  /** Latest progress line from fetch/pull/push. */
  progress = $state("");
  /** Incremented when the active repo changes or its HEAD, a branch, remote branch or tag moves; LogView reloads on change. */
  historyVersion = $state(0);
  /**
   * Incremented when files outside every repository change, or entries anywhere are created, deleted or
   * renamed; tabs of files outside a repository reload on change (the others follow their status).
   */
  workspaceVersion = $state(0);
  /** Incremented when entries are created, deleted or renamed, or ignore rules change; the Files panel re-lists. */
  listingVersion = $state(0);
  /**
   * Per absolute file path: incremented when a file open in a tab changes where git ignores it (a log file),
   * so its tab reloads although no status changed.
   */
  openFileVersions = $state.raw<Record<string, number>>({});
  /**
   * Per repository root: incremented when its work tree, index or HEAD changes. An unchanged status keeps its object,
   * so open tabs and the Changes diff follow this to see a file edited or staged again while its status stays the same.
   */
  fileVersions = $state.raw<Record<string, number>>({});
  /**
   * Per repository root: incremented when HEAD, the index, entries or a `.gitattributes` may have changed (an event,
   * a git operation, Refresh All), not for content edits. The Git LFS state follows this.
   */
  treeVersions = $state.raw<Record<string, number>>({});
  private viewState = $state<MainView>("diff");
  /** Conflicted path (in the active repository) open in the merge view. */
  mergeTarget = $state<string | null>(null);
  conflictsOpen = $state(false);
  /** The editor groups and which one has the focus (editorGroups.ts). */
  private groupsState = $state.raw<GroupsState>(initialGroups());
  /** Every open editor tab once, left group first. */
  tabs = $derived(allTabs(this.groupsState));
  /** The files open in any tab, sorted and once each, for the watcher (api.watchOpenFiles). */
  openFilePaths = $derived([...new Set(this.tabs.map((tab) => tab.path).filter(isFileTab))].sort());
  /** Absolute path of the focused group's active tab. */
  openFilePath = $derived(focusedGroup(this.groupsState).active);
  /** Set by the changes view: a selected change keeps the first group's Diff tab. */
  private primaryContent: () => boolean = () => false;
  /** A folder being opened: shown as a progress card, since there is nothing else to show yet. */
  opening = $state<{ title: string; step: string } | null>(null);
  /** Statuses still loading after a folder opened, shown in the status bar without blocking anything. */
  loadingChanges = $state<{ done: number; total: number } | null>(null);
  /** What a commit tab shows besides its commit, keyed by tab path (see commitTabs.ts). */
  commitTabs = $state.raw<Record<string, CommitTabInfo>>({});
  /** A commit the Log view should select, e.g. after clicking a blame note. */
  logFocus = $state<{
    repoRoot: string;
    commitId: string;
    filePath: string | null;
    line: number | null;
    /** Text of that line, to find it in the commit's version when `line` is a guess. */
    lineText: string | null;
    token: number;
  } | null>(null);
  private logFocusToken = 0;

  // Tab session (tabSession.ts, closedTabs.ts, tabLimit.ts): kept small, paths and numbers only.
  /** Recently closed tabs for Reopen Closed Tab, newest last. */
  closedTabs = $state.raw<ClosedTab[]>([]);
  /** Restored tabs (by group and path) whose file is not loaded yet; the editor mounts the first time the tab is shown. */
  dormantTabs = $state.raw<ReadonlySet<string>>(new Set());
  /** When each tab was last shown, for the tab limit's least recently used choice. */
  private tabUse = new Map<string, number>();
  /** When each tab (by dormant key) was last on screen, for Unload hidden tabs. */
  private tabShownAt = new Map<string, number>();
  private tabUseClock = 0;
  /** Last known caret and scroll of open file tabs, saved with the session. */
  private tabPositions = new Map<string, TabPosition>();
  /** Positions a restored or reopened tab's editor applies when it opens. */
  private pendingPositions = new Map<string, TabPosition>();
  private tabsSaveTimer: ReturnType<typeof setTimeout> | undefined;

  private unlisteners: UnlistenFn[] = [];
  private tabsClosedListeners: Array<(tabPaths: string[]) => void> = [];
  private inflight = new Map<string, Promise<void>>();
  private queued = new Set<string>();
  /** Repository whose stash list last failed to load, so the error shows once, not on every refresh. */
  private stashErrorRepo: string | null = null;
  private rescanTimer: ReturnType<typeof setTimeout> | undefined;
  /** Hash of the status held per repository root, sent back so an unchanged status is not sent again. */
  private statusHashes = new Map<string, string>();
  /** Fingerprint of the active repository's refs, stashes, remotes and worktrees, and of its branch tips. */
  private refsState: { repoRoot: string; fingerprint: string; tips: string } | null = null;
  /** Orders writes, reads and watcher events: `stamp()` only grows. */
  private clock = 0;
  /** `stamp()` when each repository's latest status read started. */
  private statusReadAt = new Map<string, number>();
  /** `stamp()` of the latest watcher event. */
  private watcherEventAt = 0;

  /**
   * What the first editor group shows: the Diff tab, the Log, its file tabs or nothing.
   * Showing the Diff or the Log focuses that group.
   */
  get view(): MainView {
    return this.viewState;
  }

  set view(next: MainView) {
    this.viewState = next;
    if (next === "diff" || next === "log") {
      this.groupsState = focusGroup(this.groupsState, this.groupsState.groups[0].id);
    }
  }

  /** Status of the active repository. */
  get status(): RepoStatus | null {
    return this.repo ? (this.statuses[this.repo.root] ?? null) : null;
  }

  get conflictCount(): number {
    return this.status?.files.filter((file) => file.conflicted).length ?? 0;
  }

  /** Changed files across every repository. */
  get totalChanges(): number {
    return Object.values(this.statuses).reduce((sum, status) => sum + status.files.length, 0);
  }

  /** Opens one folder, replacing the current workspace. */
  open(folderPath: string): Promise<boolean> {
    return this.openFolders([folderPath]);
  }

  /**
   * Opens several folders as one workspace, replacing the current one. Never throws: every
   * failure is a toast naming the folder, so a failed start cannot fall back to the welcome screen silently.
   */
  async openFolders(folderPaths: string[], workspaceFile: string | null = null, options: OpenOptions = {}): Promise<boolean> {
    try {
      return await this.replaceWorkspace(folderPaths, workspaceFile, options);
    } catch (error) {
      const failure = openFailure(folderPaths, errorMessage(error));
      toast.error(failure.title, failure.detail);
      // A failure after the workspace is on screen (watching, listening) still leaves it usable.
      return this.workspace !== null;
    }
  }

  private async replaceWorkspace(folderPaths: string[], workspaceFile: string | null, options: OpenOptions): Promise<boolean> {
    // Already open in another window: that window comes to the front instead (false: not opened here).
    if (options.focusExisting ?? true) {
      const owner = await api.windowFocusOwner(folderPaths, workspaceFile).catch(() => null);
      if (owner !== null) {
        return false;
      }
    }
    // Opening replaces the workspace and its tabs, so ask before anything changes.
    if (!(await this.confirmDiscardAll())) {
      return false;
    }
    const infos = [];
    this.opening = { title: openingTitle(folderPaths), step: "Looking for repositories..." };
    try {
      for (const folderPath of folderPaths) {
        if (folderPaths.length > 1) {
          this.opening = { title: openingTitle(folderPaths), step: `Looking for repositories in ${baseName(folderPath)}...` };
        }
        try {
          infos.push(await api.openWorkspace(folderPath));
        } catch (error) {
          const failure = openFailure([folderPath], errorMessage(error));
          toast.error(failure.title, failure.detail);
        }
      }
    } finally {
      this.opening = null;
    }
    if (infos.length === 0) {
      return false;
    }
    const folders: WorkspaceFolder[] = [];
    for (const info of infos) {
      if (!folders.some((folder) => folder.root === info.root)) {
        folders.push({ root: info.root, name: info.name, repoRoots: info.repos.map((repo) => repo.root) });
      }
    }
    await this.teardown();
    this.workspace = describeWorkspace(folders, workspaceFile);
    this.repos = unionRepos(infos.map((info) => info.repos));
    if (folders.length === 1 && !workspaceFile) {
      settings.addRecent(folders[0].root);
    }
    settings.rememberSession(
      folders.map((folder) => folder.root),
      workspaceFile,
    );
    this.repo = this.pickActive(this.workspace, this.repos);
    await this.restoreTabs(this.workspace);
    // The workspace is on screen now; statuses fill in as they arrive, with a counter in the status bar.
    await this.loadAllChanges();
    this.historyVersion++;
    await this.watchAll();
    this.unlisteners.push(
      await onRepoChanged((event) => {
        this.watcherEventAt = this.stamp();
        if (!this.repos.some((repo) => repo.root === event.repoPath)) {
          return;
        }
        if (event.workTree || event.index || event.refs) {
          // Replaced, not mutated, so effects that read the whole record rerun too.
          this.fileVersions = { ...this.fileVersions, [event.repoPath]: (this.fileVersions[event.repoPath] ?? 0) + 1 };
        }
        if (treeChanged(event)) {
          this.treeChanged([event.repoPath]);
        }
        void this.refreshRepo(event.repoPath, repoRefresh(event).refs);
      }),
      await onWorkspaceChanged((event) => {
        this.watcherEventAt = this.stamp();
        if (!this.workspace?.folders.some((folder) => folder.root === event.workspaceRoot)) {
          return;
        }
        const plan = workspaceRefresh(event);
        if (plan.listing) {
          this.listingVersion++;
        }
        if (plan.looseFiles) {
          this.workspaceVersion++;
        }
        if (plan.rescan) {
          this.scheduleRescan();
        }
      }),
      await onOpenFilesChanged((event) => {
        this.watcherEventAt = this.stamp();
        // Files no tab shows any more are dropped here, so the record stays small.
        const open = new Set(this.openFilePaths);
        const next = Object.fromEntries(Object.entries(this.openFileVersions).filter(([filePath]) => open.has(filePath)));
        for (const filePath of event.filePaths) {
          next[filePath] = (next[filePath] ?? 0) + 1;
        }
        this.openFileVersions = next;
      }),
      await onGitProgress((event) => {
        if (event.repoPath === this.repo?.root) {
          this.progress = event.line;
        }
      }),
    );
    return true;
  }

  /** Adds a folder to the open workspace ("Add Folder to Workspace"). */
  async addFolder(folderPath: string): Promise<void> {
    if (!this.workspace) {
      await this.open(folderPath);
      return;
    }
    let info;
    this.opening = { title: `Adding ${baseName(folderPath)}`, step: "Looking for repositories..." };
    try {
      info = await api.openWorkspace(folderPath);
    } catch (error) {
      toast.error("Could not add folder", errorMessage(error));
      return;
    } finally {
      this.opening = null;
    }
    const added = info;
    if (this.workspace.folders.some((folder) => folder.root === added.root)) {
      toast.info(`${added.name} is already in the workspace`);
      return;
    }
    const folders = [...this.workspace.folders, { root: added.root, name: added.name, repoRoots: added.repos.map((repo) => repo.root) }];
    this.workspace = describeWorkspace(folders, this.workspace.file);
    this.workspaceIdChanged();
    this.repos = unionRepos([this.repos, added.repos]);
    settings.rememberSession(
      folders.map((folder) => folder.root),
      this.workspace.file,
    );
    await this.syncWorkspaceFile();
    if (!this.repo) {
      this.repo = this.pickActive(this.workspace, this.repos);
      this.historyVersion++;
    }
    await this.watchFolder(folders[folders.length - 1]);
    await Promise.all([...added.repos.map((repo) => this.refreshRepoStatus(repo.root)), this.refreshActive()]);
    this.filesChanged();
    toast.success(`Added ${added.name} to the workspace`);
  }

  /** Removes a folder from the workspace, closing its tabs first. */
  async removeFolder(folderRoot: string): Promise<void> {
    const workspace = this.workspace;
    if (!workspace || !workspace.folders.some((folder) => folder.root === folderRoot)) {
      return;
    }
    if (workspace.folders.length === 1) {
      await this.closeWorkspace();
      return;
    }
    const closing = tabsInFolder(
      this.tabs.map((tab) => tab.path),
      folderRoot,
    );
    if (closing.length > 0 && !(await this.closeTabs(closing))) {
      return;
    }
    await api.unwatchWorkspace(folderRoot).catch(() => undefined);
    const folders = workspace.folders.filter((folder) => folder.root !== folderRoot);
    this.workspace = describeWorkspace(folders, workspace.file);
    this.workspaceIdChanged();
    const keep = new Set(folders.flatMap((folder) => folder.repoRoots));
    this.repos = this.repos.filter((repo) => keep.has(repo.root));
    this.statuses = Object.fromEntries(Object.entries(this.statuses).filter(([root]) => keep.has(root)));
    if (this.repo && !keep.has(this.repo.root)) {
      this.repo = this.pickActive(this.workspace, this.repos);
      this.mergeTarget = null;
      this.conflictsOpen = false;
      this.historyVersion++;
      await this.refreshActive();
    }
    settings.rememberSession(
      folders.map((folder) => folder.root),
      workspace.file,
    );
    await this.syncWorkspaceFile();
    this.filesChanged();
  }

  /** Opens a `.gitmanager-workspace` or `.code-workspace` file. */
  async openWorkspaceFile(filePath: string, options: OpenOptions = {}): Promise<boolean> {
    let saved;
    try {
      saved = await api.readWorkspaceFile(filePath);
    } catch (error) {
      const failure = openFailure([filePath], errorMessage(error));
      toast.error(failure.title, failure.detail);
      return false;
    }
    if (saved.missing.length > 0) {
      toast.info(
        `${saved.missing.length} ${saved.missing.length === 1 ? "folder was" : "folders were"} not found`,
        saved.missing.join("\n"),
      );
    }
    if (saved.folders.length === 0) {
      toast.error("The workspace file lists no folders that exist");
      return false;
    }
    return this.openFolders(saved.folders, filePath, options);
  }

  /** Saves the open folders to a workspace file and links the workspace to it. */
  async saveWorkspaceAs(filePath: string): Promise<boolean> {
    const workspace = this.workspace;
    if (!workspace) {
      return false;
    }
    const target = isWorkspaceFile(filePath) ? filePath : `${filePath}${WORKSPACE_FILE_SUFFIXES[0]}`;
    try {
      await api.writeWorkspaceFile(
        target,
        workspace.folders.map((folder) => folder.root),
      );
    } catch (error) {
      toast.error("Could not save workspace", errorMessage(error));
      return false;
    }
    const previousId = workspace.id;
    this.workspace = describeWorkspace(workspace.folders, target);
    this.workspaceIdChanged();
    // Keep the remembered active repository under the new id.
    const activeRoot = settings.activeRepos[previousId] ?? this.repo?.root;
    if (activeRoot) {
      settings.rememberActiveRepo(this.workspace.id, activeRoot);
    }
    settings.rememberSession(
      workspace.folders.map((folder) => folder.root),
      target,
    );
    toast.success(`Saved workspace ${this.workspace.name}`, target);
    return true;
  }

  /** A folder was added or removed, or the workspace saved to a file: its id changed, so the kept text of its Untitled tabs moves to the new id. */
  private workspaceIdChanged(): void {
    const workspace = this.workspace;
    if (!workspace) {
      return;
    }
    const open = new Set(this.tabs.map((tab) => tab.path));
    unsavedText.renameWorkspace(workspace.id, (tabPath) => (open.has(tabPath) ? fileCommands.text(tabPath) : null));
  }

  /** Keeps a linked workspace file in step with the folder list. */
  private async syncWorkspaceFile(): Promise<void> {
    const workspace = this.workspace;
    if (!workspace?.file) {
      return;
    }
    await api
      .writeWorkspaceFile(
        workspace.file,
        workspace.folders.map((folder) => folder.root),
      )
      .catch((error) => toast.error("Could not update the workspace file", errorMessage(error)));
  }

  private pickActive(workspace: OpenWorkspace, repos: RepoInfo[]): RepoInfo | null {
    const remembered = settings.activeRepos[workspace.id];
    return (
      repos.find((repo) => repo.root === remembered) ??
      repos.find((repo) => workspace.folders.some((folder) => folder.root === repo.root)) ??
      repos[0] ??
      null
    );
  }

  private async watchFolder(folder: WorkspaceFolder): Promise<void> {
    await api
      .watchWorkspace(folder.root, folder.repoRoots)
      .catch((error) => toast.error(`File watching is unavailable for ${folder.name}`, errorMessage(error)));
  }

  private async watchAll(): Promise<void> {
    for (const folder of this.workspace?.folders ?? []) {
      await this.watchFolder(folder);
    }
  }

  /**
   * Close Folder / Close Workspace: closes it and forgets the session so the
   * next start shows the welcome screen. False when the user keeps unsaved edits.
   */
  async closeWorkspace(): Promise<boolean> {
    if (!(await this.close())) {
      return false;
    }
    settings.rememberSession([], null);
    return true;
  }

  /** Closes the workspace, asking first when a tab has unsaved edits; false when the user cancels. */
  async close(): Promise<boolean> {
    if (!(await this.confirmDiscardAll())) {
      return false;
    }
    await this.teardown();
    return true;
  }

  private async teardown(): Promise<void> {
    clearTimeout(this.rescanTimer);
    this.resetTabSession();
    void unsavedText.open(null);
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
    this.unlisteners = [];
    for (const folder of this.workspace?.folders ?? []) {
      await api.unwatchWorkspace(folder.root).catch(() => undefined);
    }
    this.workspace = null;
    this.repos = [];
    this.statuses = {};
    this.statusHashes.clear();
    this.statusReadAt.clear();
    this.refsState = null;
    this.repo = null;
    this.refs = null;
    this.stashes = [];
    this.remotes = [];
    this.mergeTarget = null;
    this.conflictsOpen = false;
    const closedTabs = this.tabs.map((tab) => tab.path);
    this.groupsState = initialGroups();
    this.commitTabs = {};
    this.notifyTabsClosed(closedTabs);
    if (this.viewState === "file") {
      this.viewState = "diff";
    }
  }

  async setActiveRepo(repoRoot: string): Promise<void> {
    const next = this.repos.find((repo) => repo.root === repoRoot);
    if (!next || next.root === this.repo?.root) {
      return;
    }
    this.repo = next;
    this.refs = null;
    this.stashes = [];
    this.remotes = [];
    this.mergeTarget = null;
    this.conflictsOpen = false;
    if (this.workspace) {
      settings.rememberActiveRepo(this.workspace.id, next.root);
    }
    this.historyVersion++;
    await Promise.all([this.refreshRepoStatus(next.root), this.refreshActive()]);
  }

  /** Scans every folder again, e.g. after a clone or `git init`. */
  async rediscover(): Promise<void> {
    const workspace = this.workspace;
    if (!workspace) {
      return;
    }
    try {
      const lists = await Promise.all(workspace.folders.map((folder) => api.discoverRepositories(folder.root)));
      await this.applyDiscovered(workspace, lists);
    } catch (error) {
      toast.error("Could not scan for repositories", errorMessage(error));
    }
  }

  /** The watcher saw a `.git` appear or disappear; rescan once the burst (a clone, an init) settles. */
  private scheduleRescan(): void {
    clearTimeout(this.rescanTimer);
    this.rescanTimer = setTimeout(() => void this.rescan(), RESCAN_DELAY_MS);
  }

  /** Background rescan: quiet, and only rewatches and refreshes when the repositories really changed. */
  private async rescan(): Promise<void> {
    const workspace = this.workspace;
    if (!workspace) {
      return;
    }
    let lists: RepoInfo[][];
    try {
      lists = await Promise.all(workspace.folders.map((folder) => api.discoverRepositories(folder.root)));
    } catch {
      // A folder was deleted or is being moved; its own events or a manual scan catch up.
      return;
    }
    const unchanged = workspace.folders.every((folder, index) => {
      const roots = lists[index].map((repo) => repo.root);
      return roots.length === folder.repoRoots.length && roots.every((root) => folder.repoRoots.includes(root));
    });
    if (unchanged) {
      return;
    }
    const known = new Set(this.repos.map((repo) => repo.root));
    const added = unionRepos(lists).filter((repo) => !known.has(repo.root));
    await this.applyDiscovered(workspace, lists);
    if (added.length > 0) {
      toast.info(added.length === 1 ? `Found repository ${added[0].name}` : `Found ${added.length} new repositories`);
    }
  }

  /** Takes a scan of every folder of `workspace` as the repository list. */
  private async applyDiscovered(workspace: OpenWorkspace, lists: RepoInfo[][]): Promise<void> {
    // The workspace was closed or replaced while scanning.
    if (this.workspace !== workspace) {
      return;
    }
    const folders = workspace.folders.map((folder, index) => ({
      ...folder,
      repoRoots: lists[index].map((repo) => repo.root),
    }));
    this.workspace = { ...workspace, folders };
    const repos = unionRepos(lists);
    this.repos = repos;
    const roots = new Set(repos.map((repo) => repo.root));
    this.statuses = Object.fromEntries(Object.entries(this.statuses).filter(([root]) => roots.has(root)));
    if (!this.repo || !roots.has(this.repo.root)) {
      this.repo = this.pickActive(this.workspace, repos);
      this.historyVersion++;
    }
    await this.watchAll();
    await this.refreshAll();
    this.filesChanged();
  }

  async initRepository(folderPath: string): Promise<void> {
    try {
      const created = await api.initRepository(folderPath);
      await this.rediscover();
      await this.setActiveRepo(created.root);
      toast.success(`Initialized a repository in ${created.name}`);
    } catch (error) {
      toast.error("Could not initialize repository", errorMessage(error));
    }
  }

  /** Runs `task` for `key`, coalescing overlapping calls into one extra pass. */
  private coalesce(key: string, task: () => Promise<void>): Promise<void> {
    const running = this.inflight.get(key);
    if (running) {
      this.queued.add(key);
      return running;
    }
    const promise = (async () => {
      do {
        this.queued.delete(key);
        await task();
      } while (this.queued.has(key));
    })().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  async refreshAll(): Promise<void> {
    // Read the branches again even when their fingerprint matches (Refresh All is the way out of anything stale).
    if (this.refsState) {
      this.refsState = { ...this.refsState, fingerprint: "" };
    }
    this.treeChanged(this.repos.map((repo) => repo.root));
    await Promise.all([...this.repos.map((repo) => this.refreshRepoStatus(repo.root)), this.refreshActive()]);
  }

  /** `refreshAll` with a "Reading changes 2 of 5" counter, for opening a folder. */
  private async loadAllChanges(): Promise<void> {
    const roots = this.repos.map((repo) => repo.root);
    let done = 0;
    this.loadingChanges = roots.length > 0 ? { done, total: roots.length } : null;
    try {
      await Promise.all([
        ...roots.map(async (repoRoot) => {
          await this.refreshRepoStatus(repoRoot);
          done++;
          if (this.loadingChanges) {
            this.loadingChanges = { done, total: roots.length };
          }
        }),
        this.refreshActive(),
      ]);
    } finally {
      this.loadingChanges = null;
    }
  }

  /**
   * Refreshes one repository after a change; the active one also reloads branches and stashes
   * when `refsChanged` (the Log follows when its branch tips moved).
   */
  async refreshRepo(repoRoot: string, refsChanged = true): Promise<void> {
    const tasks = [this.refreshRepoStatus(repoRoot)];
    if (repoRoot === this.repo?.root && refsChanged) {
      tasks.push(this.refreshActive());
    }
    await Promise.all(tasks);
  }

  private stamp(): number {
    return ++this.clock;
  }

  /** Bumps `treeVersions` of `repoRoots` in one update. */
  private treeChanged(repoRoots: string[]): void {
    if (repoRoots.length === 0) {
      return;
    }
    const next = { ...this.treeVersions };
    for (const repoRoot of repoRoots) {
      next[repoRoot] = (next[repoRoot] ?? 0) + 1;
    }
    this.treeVersions = next;
  }

  /** Both file views: the Files panel listing and tabs of files outside a repository. */
  private filesChanged(): void {
    this.workspaceVersion++;
    this.listingVersion++;
  }

  refreshRepoStatus(repoRoot: string): Promise<void> {
    return this.coalesce(`status:${repoRoot}`, async () => {
      this.statusReadAt.set(repoRoot, this.stamp());
      try {
        // Only a status still held may be answered with "unchanged".
        const knownHash = this.statuses[repoRoot] ? (this.statusHashes.get(repoRoot) ?? null) : null;
        const snapshot = await api.getStatus(repoRoot, knownHash);
        if (!this.repos.some((repo) => repo.root === repoRoot)) {
          return;
        }
        // Unchanged: keep the same object, so nothing depending on it runs again.
        if (snapshot.status) {
          this.statusHashes.set(repoRoot, snapshot.hash);
          this.statuses = { ...this.statuses, [repoRoot]: snapshot.status };
        }
      } catch (error) {
        if (repoRoot === this.repo?.root) {
          toast.error("Could not read status", errorMessage(error));
        }
      }
    });
  }

  /** Branches and stashes of the active repository. */
  refreshActive(): Promise<void> {
    return this.coalesce("active", async () => {
      const repoRoot = this.repo?.root;
      if (!repoRoot) {
        this.refs = null;
        this.stashes = [];
        this.remotes = [];
        return;
      }
      const held = this.refsState?.repoRoot === repoRoot && this.refs ? this.refsState : null;
      let snapshot;
      try {
        snapshot = await api.getRefsSnapshot(repoRoot, held?.fingerprint ?? null);
      } catch (error) {
        toast.error("Could not read branches", errorMessage(error));
        snapshot = null;
      }
      if (this.repo?.root !== repoRoot) {
        return;
      }
      // Nothing the sidebar shows changed: refs, stashes, remotes and worktrees stay as they are.
      if (snapshot && !snapshot.refs) {
        return;
      }
      if (snapshot) {
        const previous = this.refsState?.repoRoot === repoRoot ? this.refsState : null;
        this.refsState = { repoRoot, fingerprint: snapshot.fingerprint, tips: snapshot.tips };
        if (previous && previous.tips !== snapshot.tips) {
          this.historyVersion++;
        }
      }
      const refs = snapshot?.refs ?? null;
      const [stashes, remotes] = await Promise.all([
        api.getStashes(repoRoot).then(
          (stashes) => {
            this.stashErrorRepo = null;
            return stashes;
          },
          (error) => {
            // Refreshes run on every file change, so tell once and keep the list empty.
            if (this.stashErrorRepo !== repoRoot) {
              this.stashErrorRepo = repoRoot;
              toast.error("Could not read stashes", errorMessage(error));
            }
            return [] as StashEntry[];
          },
        ),
        // Only the GitHub submenu and Manage Remotes read them: quiet on failure.
        api.listRemotes(repoRoot).catch(() => [] as RemoteInfo[]),
      ]);
      if (this.repo?.root === repoRoot) {
        this.refs = refs;
        this.stashes = stashes;
        this.remotes = remotes;
      }
    });
  }

  /** Kept for existing callers: refreshes the active repository's status. */
  refreshStatus(): Promise<void> {
    return this.repo ? this.refreshRepoStatus(this.repo.root) : Promise.resolve();
  }

  /** Runs a mutation with busy state, error toast and a refresh afterwards. */
  async run<T>(label: string, work: (repoPath: string) => Promise<T>, options: RunOptions<T> = {}): Promise<T | undefined> {
    const repoPath = options.repoPath ?? this.repo?.root;
    if (!repoPath) {
      return undefined;
    }
    this.busy = label;
    this.progress = "";
    // A toast with a button waits for the refresh, so its button sees the state after the work.
    let withAction: { message: string; result: T } | null = null;
    try {
      const result = await work(repoPath);
      const message = typeof options.success === "function" ? options.success(result) : options.success;
      if (message && options.action) {
        withAction = { message, result };
      } else if (message) {
        toast.success(message);
      }
      return result;
    } catch (error) {
      toast.error(`${label} failed`, errorMessage(error));
      return undefined;
    } finally {
      this.busy = null;
      this.progress = "";
      const refresh = options.refresh ?? true;
      if (refresh) {
        // A git operation may move HEAD or the index without a watcher (or before its event).
        this.treeChanged([repoPath]);
        await this.refreshRepo(repoPath, refresh !== "status");
      }
      if (withAction) {
        const action = options.action?.(withAction.result) ?? null;
        if (action) {
          toast.successWithAction(withAction.message, undefined, action);
        } else {
          toast.success(withAction.message);
        }
      }
    }
  }

  /** Like `run`, for operations that may stop on conflicts. */
  async runOp(
    label: string,
    work: (repoPath: string) => Promise<OpOutcome>,
    successMessage?: string,
    repoPath?: string,
  ): Promise<OpOutcome | undefined> {
    const outcome = await this.run(label, work, { repoPath });
    if (!outcome) {
      return undefined;
    }
    if (outcome.conflicts) {
      toast.info(`${label} stopped with conflicts`, "Resolve them to continue.");
      if (repoPath) {
        await this.setActiveRepo(repoPath);
      }
      this.conflictsOpen = true;
    } else if (successMessage) {
      toast.success(successMessage);
    }
    return outcome;
  }

  /** Absolute paths of the file tabs with unsaved edits. */
  get dirtyPaths(): string[] {
    return this.tabs.filter((tab) => tab.dirty).map((tab) => tab.path);
  }

  /**
   * Files were written outside an editor (Replace in Files, the Files panel, MCP). The watcher's
   * event refreshes the owning repositories and the file views once; this only steps in when no
   * event comes (ignored files, no watcher), so a write is never read twice.
   */
  async filesWritten(filePaths: string[]): Promise<void> {
    const repoRoots = new Set(
      filePaths.map((filePath) => locateAbsolute(this.repos, filePath)?.repo.root ?? null).filter((root) => root !== null),
    );
    await this.afterWatcher([...repoRoots], true);
  }

  /** A file tab saved a file in `repoRoot`: one status read follows, from the watcher's event or else from here. */
  fileSaved(repoRoot: string): void {
    void this.afterWatcher([repoRoot], false);
  }

  /** Waits for the watcher to report a write at "now", then refreshes whatever it did not. */
  private async afterWatcher(repoRoots: string[], fileViews: boolean): Promise<void> {
    const writtenAt = this.stamp();
    await new Promise((resolve) => setTimeout(resolve, WATCHER_FALLBACK_MS));
    const plan = writeFallback(writtenAt, repoRoots, (repoRoot) => this.statusReadAt.get(repoRoot) ?? 0, this.watcherEventAt);
    if (fileViews && plan.files) {
      this.filesChanged();
    }
    // No event came for these (no watcher, or ignored files): a write may have added a `.gitattributes`.
    if (fileViews) {
      this.treeChanged(plan.statusOf);
    }
    await Promise.all(plan.statusOf.map((repoRoot) => this.refreshRepoStatus(repoRoot)));
  }

  /** The active file tab has unsaved edits. */
  get fileDirty(): boolean {
    return this.isDirty(this.openFilePath);
  }

  isDirty(filePath: string | null): boolean {
    return filePath !== null && this.tabs.some((tab) => tab.path === filePath && tab.dirty);
  }

  /** The editor groups, left to right (editorGroups.ts). */
  get groups(): readonly EditorGroup[] {
    return this.groupsState.groups;
  }

  get focusedGroupId(): number {
    return focusedGroup(this.groupsState).id;
  }

  /** The first (left) group: it also shows the Diff tab, the Log and the empty view. */
  get primaryGroupId(): number {
    return this.groupsState.groups[0].id;
  }

  /** The first group's active tab, whatever group has the focus. */
  get primaryActive(): string | null {
    return this.groupsState.groups[0].active;
  }

  groupById(groupId: number): EditorGroup | null {
    return groupById(this.groupsState, groupId);
  }

  /** The changes view registers what keeps an empty first group open (a selected change). */
  setPrimaryContent(check: () => boolean): void {
    this.primaryContent = check;
  }

  /** An empty first group stays while it shows the Diff tab or the Log. */
  private keepPrimaryGroup(): boolean {
    return this.viewState === "log" || this.primaryContent();
  }

  /** Puts new groups on screen: tabs no group has any more are remembered and reported, empty groups close. */
  private applyGroups(next: GroupsState): void {
    const before = this.groupsState;
    // Whatever changed the strips (a merge, a reopen, a move), pinned tabs stay at the start.
    const ordered = mapGroups(next, (group) => ({ ...group, tabs: pinnedFirst(group.tabs) }));
    const groups = dropEmptyGroups(ordered, this.keepPrimaryGroup());
    const closedTabs = closedBetween(before, groups).map((tab) => tab.path);
    this.rememberClosedTabs(closedTabs, before);
    this.groupsState = groups;
    const primary = groups.groups[0];
    // The right group took the left one's place: it shows its tabs there.
    if (primary.id !== before.groups[0].id && primary.tabs.length > 0) {
      this.viewState = "file";
    }
    if (!primary.active && this.viewState === "file") {
      this.viewState = "diff";
    }
    const open = new Set(this.tabs.map((tab) => tab.path));
    // Forget what closed commit tabs showed.
    if (Object.keys(this.commitTabs).some((tabPath) => !open.has(tabPath))) {
      this.commitTabs = Object.fromEntries(Object.entries(this.commitTabs).filter(([tabPath]) => open.has(tabPath)));
    }
    this.notifyTabsClosed(closedTabs);
    this.tabsChanged(closedTabs);
  }

  /** A group got a tab on screen: the first group switches to its files. */
  private showGroup(groupId: number): void {
    if (groupId === this.primaryGroupId) {
      this.viewState = "file";
    }
  }

  /** Re-checks the groups, e.g. after the Diff tab closed: an empty first group may close now. */
  tidyGroups(): void {
    const next = dropEmptyGroups(this.groupsState, this.keepPrimaryGroup());
    if (next !== this.groupsState) {
      this.applyGroups(next);
    }
  }

  /**
   * Tells listeners which tabs just closed, however they closed (x, Close
   * Others, teardown). The terminal store uses it to stop the shell of a closed
   * terminal tab; it registers itself so this store never imports it.
   */
  onTabsClosed(listener: (tabPaths: string[]) => void): () => void {
    this.tabsClosedListeners.push(listener);
    return () => {
      this.tabsClosedListeners = this.tabsClosedListeners.filter((candidate) => candidate !== listener);
    };
  }

  private notifyTabsClosed(tabPaths: string[]): void {
    if (tabPaths.length === 0) {
      return;
    }
    unsavedText.forgetTabs(tabPaths);
    for (const listener of this.tabsClosedListeners) {
      listener(tabPaths);
    }
  }

  /** The group an open of `tabPath` goes to (see openTarget); `toSide` is Open to the Side. */
  targetGroupFor(tabPath: string, toSide = false): number {
    return openTarget(this.groupsState, tabPath, toSide && settings.splitEditor);
  }

  /** Opens a tab in `groupId` (made when it is the next id), applying the tab limit to a new one. */
  private openIn(groupId: number, tabPath: string, pin: boolean, limit: boolean): void {
    const isNew = !hasTab(groupById(this.groupsState, groupId) ?? { tabs: [], active: null }, tabPath);
    const next = openInGroup(this.groupsState, groupId, tabPath, pin);
    const target = focusedGroup(next).id;
    this.applyGroups(isNew && limit ? this.withTabLimit(next, { groupId: target, tabPath }) : next);
    this.showGroup(this.focusedGroupId);
  }

  /**
   * Opens a tab that is not a file (see pseudoTabs.ts), such as a terminal in
   * the editor area. It opens pinned, since it is always a deliberate open.
   */
  openPseudoTab(tabPath: string): void {
    this.openIn(this.targetGroupFor(tabPath), tabPath, true, false);
  }

  /** File > New File: an empty Untitled tab in the focused group. */
  newUntitledTab(): string | null {
    if (!this.workspace) {
      return null;
    }
    const tabPath = newUntitledPath();
    this.openIn(this.focusedGroupId, tabPath, true, false);
    return tabPath;
  }

  /** An Untitled tab was saved as `filePath` inside the workspace: its tab shows that file now, in every group. */
  replaceUntitledTab(tabPath: string, filePath: string): void {
    unsavedText.discard([tabPath]);
    const next = mapGroups(this.groupsState, (group) => replaceTabPath(group, tabPath, filePath));
    if (next !== this.groupsState) {
      this.applyGroups(next);
      this.showGroup(this.focusedGroupId);
    }
  }

  /**
   * Opens a commit in its own editor tab, so its diff gets the
   * whole editor area. `filePath` (repo-relative) picks the file to show; an
   * open tab for the same commit is reused and switched to that file.
   */
  openCommitTab(repoRoot: string, commitId: string, options: { summary?: string | null; filePath?: string | null } = {}): void {
    const tabPath = commitTabPath(repoRoot, commitId);
    const previous = this.commitTabs[tabPath];
    this.commitTabs = {
      ...this.commitTabs,
      [tabPath]: {
        summary: options.summary ?? previous?.summary ?? null,
        focus: options.filePath ? { path: options.filePath, token: (previous?.focus?.token ?? 0) + 1 } : (previous?.focus ?? null),
      },
    };
    this.openIn(this.targetGroupFor(tabPath), tabPath, true, false);
  }

  /**
   * Opens a file by absolute path. A plain open uses the preview tab (a
   * single click); `pin` keeps the tab open (double click, or an explicit open).
   * `toSide` opens it in the other editor group (Open to the Side).
   */
  async openFile(filePath: string, options: { pin?: boolean; toSide?: boolean } = {}): Promise<void> {
    this.openIn(this.targetGroupFor(filePath, options.toSide ?? false), filePath, options.pin ?? false, true);
  }

  /** A click on a tab in a group's strip: shows it there and focuses that group. */
  activateTab(groupId: number, tabPath: string): void {
    this.openIn(groupId, tabPath, false, false);
  }

  /** Focus moved into a group (a click or the keyboard). */
  focusGroup(groupId: number): void {
    const next = focusGroup(this.groupsState, groupId);
    if (next !== this.groupsState) {
      this.groupsState = next;
      const active = focusedGroup(next).active;
      if (active !== null) {
        this.tabUse.set(active, ++this.tabUseClock);
      }
    }
  }

  /** Focus Left / Right Group: false when there is no group at `index`. */
  focusGroupAt(index: number): boolean {
    const group = this.groupsState.groups[index];
    if (!group) {
      return false;
    }
    this.focusGroup(group.id);
    return true;
  }

  /** Split Right: `shownTab` (the focused group's tab on screen) also opens in the right group. */
  splitRight(shownTab: string | null): void {
    if (!settings.splitEditor || !canSplitRight(this.groupsState, shownTab)) {
      return;
    }
    this.applyGroups(splitRight(this.groupsState, shownTab));
  }

  canSplitRight(shownTab: string | null): boolean {
    return settings.splitEditor && canSplitRight(this.groupsState, shownTab);
  }

  /** Move Tab to Other Group, made when there is only one. */
  moveTabToOtherGroup(tabPath: string, groupId: number = this.focusedGroupId): void {
    if (!settings.splitEditor) {
      return;
    }
    const next = moveToOtherGroup(this.groupsState, groupId, tabPath);
    if (next !== this.groupsState) {
      this.applyGroups(next);
      this.showGroup(this.focusedGroupId);
    }
  }

  /** Close Group: its tabs close, asking first about unsaved edits not open in the other group. */
  async closeGroup(groupId: number = this.focusedGroupId): Promise<boolean> {
    if (this.groupsState.groups.length < 2) {
      return false;
    }
    const closed = closedBetween(this.groupsState, closeGroup(this.groupsState, groupId));
    const dirty = closed.filter((tab) => tab.dirty);
    if (!(await this.confirmDiscard(dirty, dirty.length === 1 ? "Close it" : "Close them"))) {
      return false;
    }
    this.applyGroups(closeGroup(this.groupsState, groupId));
    unsavedText.discard(closed.map((tab) => tab.path));
    return true;
  }

  /** Settings > Editor > Split editor turned off: one group with every tab. */
  mergeGroups(): void {
    if (this.groupsState.groups.length > 1) {
      this.applyGroups(mergeGroups(this.groupsState));
    }
  }

  /** Makes a preview tab a normal tab, in one group or in every group. */
  pinFile(filePath: string, groupId: number | null = null): void {
    const next = mapGroups(this.groupsState, (group) => (groupId === null || group.id === groupId ? pinTab(group, filePath) : group));
    if (next !== this.groupsState) {
      this.applyGroups(next);
    }
  }

  /** The editor reports unsaved edits; editing also pins a preview tab. Every group's tab of the file follows. */
  setDirty(filePath: string, dirty: boolean): void {
    if (!dirty) {
      // Saved, reverted or edited back: no text to keep for it any more.
      unsavedText.discard([filePath]);
    }
    const next = setDirtyEverywhere(this.groupsState, filePath, dirty);
    if (next !== this.groupsState) {
      this.groupsState = next;
      this.scheduleTabsSave();
    }
  }

  /**
   * Closes tabs in one group, or in every group (null), asking first when a tab with unsaved
   * edits would close everywhere. Still open in the other group, a file keeps its edits.
   */
  async closeTabs(filePaths: string[], groupId: number | null = null): Promise<boolean> {
    const closed = closedBetween(this.groupsState, closeInGroups(this.groupsState, filePaths, groupId));
    const dirty = closed.filter((tab) => tab.dirty);
    if (!(await this.confirmDiscard(dirty, dirty.length === 1 ? "Close it" : "Close them"))) {
      return false;
    }
    this.applyGroups(closeInGroups(this.groupsState, filePaths, groupId));
    // A tab closed by hand gives up its unsaved text; one still open in the other group keeps it.
    unsavedText.discard(closed.map((tab) => tab.path));
    return true;
  }

  /** Before the window closes: asks when a tab has unsaved edits, unless Remember unsaved changes keeps them. */
  confirmCloseWindow(): Promise<boolean> {
    return this.confirmLeave("Close the window");
  }

  /** Before the whole workspace goes away (close, or opening another one). */
  private confirmDiscardAll(): Promise<boolean> {
    const what = (this.workspace?.folders.length ?? 0) > 1 ? "workspace" : "folder";
    return this.confirmLeave(`Close the ${what}`);
  }

  /**
   * The window or the workspace goes: with Remember unsaved changes every unsaved text is
   * kept for next time without asking; otherwise the user confirms that it is thrown away.
   */
  private async confirmLeave(action: string): Promise<boolean> {
    if (settings.rememberUnsaved) {
      await this.keepUnsaved();
      return true;
    }
    const dirty = this.tabs.filter((tab) => tab.dirty);
    if (!(await this.confirmDiscard(dirty, action))) {
      return false;
    }
    unsavedText.discard(dirty.map((tab) => tab.path));
    await unsavedText.flush();
    return true;
  }

  /**
   * Remember unsaved changes: every unsaved text is written and the tabs are in state.json, so
   * closing the window, the workspace or the page (Clear Cache) loses nothing.
   */
  async keepUnsaved(): Promise<void> {
    for (const tab of this.tabs) {
      // Edits made before the setting was turned on were never written.
      if (tab.dirty && !unsavedText.has(tab.path)) {
        unsavedText.schedule(tab.path, () => fileCommands.text(tab.path));
      }
    }
    await unsavedText.flush();
    this.saveTabSession();
    await settings.flushNow();
  }

  /** Asks before unsaved edits in `dirty` are thrown away; `action` starts the question, e.g. "Close it". */
  private async confirmDiscard(dirty: FileTab[], action: string): Promise<boolean> {
    if (dirty.length === 0) {
      return true;
    }
    const names = dirty.map((tab) => tabName(tab));
    return dialogs.confirm({
      title: "Unsaved Changes",
      message:
        dirty.length === 1
          ? `${names[0]} has unsaved changes. ${action} and discard them?`
          : `${dirty.length} files have unsaved changes (${names.join(", ")}). ${action} and discard the changes?`,
      confirmLabel: "Discard",
      danger: true,
    });
  }

  /**
   * Before renaming, moving or trashing `entryPaths`: false, with a toast, when an open file
   * there (or inside one of those folders) has unsaved edits, since they would be lost or
   * saved to the old path.
   */
  checkUnsaved(entryPaths: string[]): boolean {
    const dirty = fileTabsUnder(this.dirtyPaths, entryPaths);
    if (dirty.length === 0) {
      return true;
    }
    const names = dirty.map((tabPath) => baseName(tabPath));
    if (dirty.length === 1) {
      toast.info(`Save or revert ${names[0]} first`, "It has unsaved changes.");
    } else {
      toast.info(`Save or revert ${dirty.length} files first`, names.join(", "));
    }
    return false;
  }

  /** Files were renamed or moved on disk: their tabs (and tabs inside moved folders) follow them, in every group. */
  retargetTabs(moves: PathMove[]): void {
    const next = mapGroups(this.groupsState, (group) => retargetTabs(group, moves));
    if (next !== this.groupsState) {
      this.applyGroups(next);
    }
  }

  /** Closes the tabs of files that were just moved to the Trash, without asking (none had unsaved edits). */
  closeTabsUnder(entryPaths: string[]): void {
    const closing = fileTabsUnder(
      this.tabs.map((tab) => tab.path),
      entryPaths,
    );
    if (closing.length > 0) {
      this.applyGroups(closeInGroups(this.groupsState, closing, null));
    }
  }

  /** Closes a tab in `groupId`, or in every group (null). */
  closeTab(filePath: string, groupId: number | null = null): Promise<boolean> {
    return this.closeTabs([filePath], groupId);
  }

  closeOtherTabs(filePath: string, groupId: number = this.focusedGroupId): Promise<boolean> {
    const group = groupById(this.groupsState, groupId);
    return group ? this.closeTabs(otherPaths(group, filePath), groupId) : Promise.resolve(false);
  }

  closeTabsToRight(filePath: string, groupId: number = this.focusedGroupId): Promise<boolean> {
    const group = groupById(this.groupsState, groupId);
    return group ? this.closeTabs(pathsToRight(group, filePath), groupId) : Promise.resolve(false);
  }

  /** Close All in one group's strip, or in every group (null); pinned tabs stay. */
  closeAllTabs(groupId: number | null = null): Promise<boolean> {
    const group = groupId === null ? null : groupById(this.groupsState, groupId);
    return this.closeTabs(unpinnedPaths(group ? group.tabs : this.tabs), groupId);
  }

  /** A tab dragged within its group's strip to `gap` (see moveTab in tabs.ts). */
  moveTab(groupId: number, tabPath: string, gap: number): void {
    const next = mapGroups(this.groupsState, (group) => (group.id === groupId ? moveTab(group, tabPath, gap) : group));
    if (next !== this.groupsState) {
      this.applyGroups(next);
    }
  }

  /** Closes the focused group's active tab. */
  async closeFile(): Promise<void> {
    if (this.openFilePath) {
      await this.closeTab(this.openFilePath, this.focusedGroupId);
    }
  }

  /** Pin Tab / Unpin Tab, in every group: a pinned tab sits at the start and only closes on its own. */
  setTabPinned(tabPath: string, pinned: boolean): void {
    const next = mapGroups(this.groupsState, (group) => setTabPinned(group, tabPath, pinned));
    if (next !== this.groupsState) {
      this.applyGroups(next);
    }
  }

  isPinned(tabPath: string | null): boolean {
    return tabPath !== null && this.tabs.some((tab) => tab.path === tabPath && tab.pinned === true);
  }

  /** The tab limit (Settings > Editor) over every group: closes the least recently used file tabs past it, keeping `keep`. */
  private withTabLimit(state: GroupsState, keep: GroupTab | null): GroupsState {
    return applyEvictions(state, groupEvictions(state, this.tabUse, settings.tabLimit, keep, isFileTab));
  }

  /** Closed tabs go on the Reopen Closed Tab stack; a terminal's shell is gone, so its tab cannot come back. */
  private rememberClosedTabs(closedPaths: string[], before: GroupsState): void {
    if (closedPaths.length === 0) {
      return;
    }
    const entries: ClosedTab[] = [];
    for (const tabPath of closedPaths) {
      const side = sideOf(before, tabPath);
      const group = before.groups[side];
      const index = group ? group.tabs.findIndex((tab) => tab.path === tabPath) : -1;
      // A terminal's shell is gone; an Untitled tab's text was discarded or saved as a file.
      if (!group || index < 0 || isTerminalTab(tabPath) || isUntitledTab(tabPath)) {
        continue;
      }
      const tab = group.tabs[index];
      entries.push({
        path: tabPath,
        index,
        preview: tab.preview,
        pinned: tab.pinned ?? false,
        position: this.tabPositions.get(tabPath) ?? this.pendingPositions.get(tabPath) ?? null,
        side,
      });
    }
    this.closedTabs = pushClosedTabs(this.closedTabs, entries);
  }

  /** After the strips changed: the shown tab counts as used and wakes up, closed tabs are forgotten, the session is saved soon. */
  private tabsChanged(closedPaths: string[]): void {
    const active = this.openFilePath;
    if (active !== null) {
      this.tabUse.set(active, ++this.tabUseClock);
    }
    const now = Date.now();
    for (const group of this.groupsState.groups) {
      if (group.active !== null) {
        this.tabShownAt.set(dormantKey(group.id, group.active), now);
      }
    }
    if (this.dormantTabs.size > 0) {
      // A tab sleeps until its group shows it; closed ones are forgotten.
      const sleeping = new Set<string>();
      for (const group of this.groupsState.groups) {
        for (const tab of group.tabs) {
          const key = dormantKey(group.id, tab.path);
          if (!this.dormantTabs.has(key)) {
            continue;
          }
          if (tab.path !== group.active) {
            sleeping.add(key);
          } else if (!this.pendingPositions.has(tab.path)) {
            // Waking after Unload hidden tabs: the new editor opens where the old one was.
            const position = this.tabPositions.get(tab.path);
            if (position) {
              this.pendingPositions.set(tab.path, position);
            }
          }
        }
      }
      if (sleeping.size !== this.dormantTabs.size) {
        this.dormantTabs = sleeping;
      }
    }
    for (const tabPath of closedPaths) {
      this.tabUse.delete(tabPath);
      this.tabPositions.delete(tabPath);
      this.pendingPositions.delete(tabPath);
    }
    this.scheduleTabsSave();
  }

  /**
   * Unload hidden tabs: file tabs out of sight for `delayMs`, without unsaved edits, go back to
   * sleep. Their editors go away, and showing one builds it again at its caret and scroll.
   */
  sleepHiddenTabs(delayMs: number, now = Date.now()): void {
    const entries: TabSleepEntry[] = this.groupsState.groups.flatMap((group) =>
      group.tabs.map((tab) => {
        const key = dormantKey(group.id, tab.path);
        return { key, shown: tab.path === group.active, eligible: isFileTab(tab.path) && !tab.dirty && !this.dormantTabs.has(key) };
      }),
    );
    const keys = tabsToSleep(entries, this.tabShownAt, now, delayMs);
    if (keys.length > 0) {
      this.dormantTabs = new Set([...this.dormantTabs, ...keys]);
    }
  }

  /** A restored tab whose editor has not been created yet. */
  isDormant(tabPath: string, groupId: number): boolean {
    return this.dormantTabs.has(dormantKey(groupId, tabPath));
  }

  /**
   * A file editor reports where its caret and view are; `topLine` null keeps the last one
   * (a hidden editor cannot measure). A closed tab's editor reports once more while it goes away.
   */
  noteTabPosition(filePath: string, line: number, column: number, topLine: number | null): void {
    const previous = this.tabPositions.get(filePath) ?? null;
    const position: TabPosition = { line, column, topLine: topLine ?? previous?.topLine ?? Math.max(0, line - 5) };
    if (this.tabs.some((tab) => tab.path === filePath)) {
      if (previous?.line !== position.line || previous.column !== position.column || previous.topLine !== position.topLine) {
        this.tabPositions.set(filePath, position);
        this.scheduleTabsSave();
      }
      return;
    }
    const next = updateClosedPosition(this.closedTabs, filePath, position);
    if (next !== this.closedTabs) {
      this.closedTabs = next;
    }
  }

  /** The position a restored or reopened tab should open at, once. */
  takePendingPosition(filePath: string): TabPosition | null {
    const position = this.pendingPositions.get(filePath) ?? null;
    this.pendingPositions.delete(filePath);
    return position;
  }

  private scheduleTabsSave(): void {
    clearTimeout(this.tabsSaveTimer);
    this.tabsSaveTimer = setTimeout(() => this.saveTabSession(), TABS_SAVE_DELAY_MS);
  }

  /** Clear Cache: the tab session is written now, since the page restarts right after. */
  saveTabsNow(): void {
    this.saveTabSession();
  }

  /**
   * Writes the open file tabs of this workspace to state.json, when Reopen tabs on start is on.
   * With Remember unsaved changes the Untitled tabs with text are kept too, and with only that
   * setting on, just the tabs with unsaved changes.
   */
  private saveTabSession(): void {
    clearTimeout(this.tabsSaveTimer);
    const workspace = this.workspace;
    const remember = settings.rememberUnsaved;
    if (!workspace || (!settings.reopenTabsOnStart && !remember)) {
      return;
    }
    const dirty = new Set(this.dirtyPaths);
    const kept = (tabPath: string) => remember && dirty.has(tabPath) && (isFileTab(tabPath) || isUntitledTab(tabPath));
    const saves = settings.reopenTabsOnStart ? (tabPath: string) => isFileTab(tabPath) || kept(tabPath) : kept;
    const positions = new Map([...this.pendingPositions, ...this.tabPositions]);
    const [left, right] = this.groupsState.groups;
    const session = tabSessionOf(
      left.tabs,
      left.active,
      saves,
      positions,
      right ? { tabs: right.tabs, active: right.active, focused: this.groupsState.focused === right.id } : null,
    );
    if (!sameTabSession(settings.openTabs[workspace.id] ?? null, session.tabs.length > 0 ? session : null)) {
      settings.rememberTabs(workspace.id, session);
    }
  }

  /** Before the workspace goes: its tabs are saved now, and the closed tab stack and positions are dropped. */
  private resetTabSession(): void {
    this.saveTabSession();
    this.closedTabs = [];
    this.dormantTabs = new Set();
    this.tabUse.clear();
    this.tabShownAt.clear();
    this.tabPositions.clear();
    this.pendingPositions.clear();
  }

  /**
   * Reopen tabs on start: the file tabs this workspace had, in both editor groups, without
   * loading any file yet. Files that are gone or outside the workspace are skipped; the tab
   * limit applies.
   */
  private async restoreTabs(workspace: OpenWorkspace): Promise<void> {
    const saved = settings.openTabs[workspace.id] ?? null;
    const kept = await this.keptTabs(workspace, new Set(saved ? sessionPaths(saved) : []));
    const keptPaths = new Set(kept);
    const session = sessionWithKept(saved, kept, settings.reopenTabsOnStart);
    if (!session || this.workspace !== workspace || this.tabs.length > 0) {
      return;
    }
    const paths = sessionPaths(session);
    const onDisk = await api
      .filesExist(
        workspace.folders.map((folder) => folder.root),
        paths,
      )
      .catch(() => [] as boolean[]);
    if (this.workspace !== workspace || this.tabs.length > 0) {
      return;
    }
    // An Untitled tab is there while its text is.
    const exists = paths.map((tabPath, index) => (isUntitledTab(tabPath) ? keptPaths.has(tabPath) : onDisk[index] === true));
    const restored = restorableTabs(session, exists, (tabPath) => isUntitledTab(tabPath) || folderFor(workspace.folders, tabPath) !== null);
    if (restored.tabs.length === 0) {
      return;
    }
    const savedGroups = [restored, ...(restored.right ? [restored.right] : [])];
    // The saved order stands in for use: later tabs are newer, the active ones newest.
    for (const group of savedGroups) {
      group.tabs.forEach((tab) => this.tabUse.set(tab.path, ++this.tabUseClock));
    }
    for (const group of savedGroups) {
      if (group.active) {
        this.tabUse.set(group.active, ++this.tabUseClock);
      }
    }
    const tabsOf = (group: SavedTabGroup): TabsState => ({
      tabs: pinnedFirst(group.tabs.map((tab) => ({ path: tab.path, preview: tab.preview, dirty: keptPaths.has(tab.path), pinned: tab.pinned }))),
      active: group.active,
    });
    let state = restoredGroups(tabsOf(restored), restored.right ? tabsOf(restored.right) : null, restored.rightFocused ?? false);
    if (!settings.splitEditor) {
      state = mergeGroups(state);
    }
    state = this.withTabLimit(state, null);
    const open = new Set(allTabs(state).map((tab) => tab.path));
    for (const tab of savedGroups.flatMap((group) => group.tabs)) {
      if (tab.position && open.has(tab.path) && !this.pendingPositions.has(tab.path)) {
        this.pendingPositions.set(tab.path, tab.position);
        this.tabPositions.set(tab.path, tab.position);
      }
    }
    this.groupsState = state;
    // Tabs with kept text load now, so they show their unsaved changes and Save All reaches them.
    this.dormantTabs = new Set(
      state.groups.flatMap((group) =>
        group.tabs.filter((tab) => tab.path !== group.active && !keptPaths.has(tab.path)).map((tab) => dormantKey(group.id, tab.path)),
      ),
    );
    this.viewState = "file";
  }

  /**
   * Remember unsaved changes: the tabs with kept text that belong to `workspace`, oldest first.
   * Untitled tabs filed under it (or listed in its saved session) and edited files in its
   * folders; a file gone from disk gives its text to a new Untitled tab, so none is lost.
   */
  private async keptTabs(workspace: OpenWorkspace, sessionTabs: ReadonlySet<string>): Promise<string[]> {
    const listed = (await unsavedText.open(workspace.id))
      .filter((meta) =>
        isUntitledTab(meta.tabPath)
          ? meta.workspaceId === workspace.id || sessionTabs.has(meta.tabPath)
          : folderFor(workspace.folders, meta.tabPath) !== null,
      )
      .map((meta) => meta.tabPath);
    const files = listed.filter((tabPath) => !isUntitledTab(tabPath));
    if (files.length === 0) {
      return listed;
    }
    const onDisk = await api
      .filesExist(
        workspace.folders.map((folder) => folder.root),
        files,
      )
      .catch(() => files.map(() => true));
    const kept: string[] = [];
    for (const tabPath of listed) {
      if (isUntitledTab(tabPath) || onDisk[files.indexOf(tabPath)] !== false) {
        kept.push(tabPath);
        continue;
      }
      const untitled = await unsavedText.moveToUntitled(tabPath);
      if (untitled) {
        kept.push(untitled);
      }
    }
    return kept;
  }

  /**
   * Reopen Closed Tab: the newest closed tab that can still open (its file exists, its
   * repository is still in the workspace), back in its group, at its place and position.
   */
  async reopenClosedTab(): Promise<boolean> {
    const workspace = this.workspace;
    if (!workspace || this.closedTabs.length === 0) {
      return false;
    }
    const filePaths = this.closedTabs.filter((tab) => isFileTab(tab.path)).map((tab) => tab.path);
    const exists =
      filePaths.length > 0
        ? await api
            .filesExist(
              workspace.folders.map((folder) => folder.root),
              filePaths,
            )
            .catch(() => filePaths.map(() => true))
        : [];
    if (this.workspace !== workspace) {
      return false;
    }
    const existing = new Set(filePaths.filter((_filePath, index) => exists[index] === true));
    const open = new Set(this.tabs.map((tab) => tab.path));
    const inWorkspace = (tabPath: string) => workspace.folders.some((folder) => tabsInFolder([tabPath], folder.root).length > 0);
    const { tab, stack } = popClosedTab(
      this.closedTabs,
      (entry) => !open.has(entry.path) && (isFileTab(entry.path) ? existing.has(entry.path) : inWorkspace(entry.path)),
    );
    this.closedTabs = stack;
    if (!tab) {
      toast.info("No closed tab to reopen");
      return false;
    }
    if (tab.position) {
      this.pendingPositions.set(tab.path, tab.position);
      this.tabPositions.set(tab.path, tab.position);
    }
    // Back in the group it closed in while that group is still there, else in the focused one.
    const group = this.groupsState.groups[tab.side ?? 0] ?? focusedGroup(this.groupsState);
    // Reopening is deliberate, so the tab comes back kept open even if it was a preview.
    const reopened = reopenAt(group.tabs, tab, (entry) => ({ path: entry.path, preview: false, dirty: false, pinned: entry.pinned }));
    const next = { ...updateGroup(this.groupsState, group.id, reopened), focused: group.id };
    this.applyGroups(this.withTabLimit(next, { groupId: group.id, tabPath: tab.path }));
    this.showGroup(group.id);
    return true;
  }

  /** Opens the conflicts dialog, switching to `repoRoot` first when given. */
  async openConflicts(repoRoot?: string): Promise<void> {
    if (repoRoot) {
      await this.setActiveRepo(repoRoot);
    }
    this.conflictsOpen = true;
  }

  /** Opens the merge tool for a repo-relative path, switching to `repoRoot` first when given. */
  async openMerge(conflictPath: string, repoRoot?: string): Promise<void> {
    if (repoRoot) {
      await this.setActiveRepo(repoRoot);
    }
    this.mergeTarget = conflictPath;
  }

  /**
   * Opens the Log on `commitId`, switching to its repository first; `filePath`
   * opens that file's diff, scrolled to `line` (or the nearest line reading `lineText`).
   */
  async showCommit(
    repoRoot: string,
    commitId: string,
    filePath: string | null,
    line: number | null = null,
    lineText: string | null = null,
  ): Promise<void> {
    if (repoRoot !== this.repo?.root) {
      if (!this.repos.some((repo) => repo.root === repoRoot)) {
        return;
      }
      await this.setActiveRepo(repoRoot);
    }
    this.logFocus = { repoRoot, commitId, filePath, line, lineText, token: ++this.logFocusToken };
    this.view = "log";
  }

  closeMerge(): void {
    this.mergeTarget = null;
  }
}

export const repoStore = new RepoStore();
