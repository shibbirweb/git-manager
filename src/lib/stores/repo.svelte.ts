// Central state for the open workspace: a folder holding any number of git
// repositories (possibly none). One repository is "active" and drives the
// branches sidebar, the log, the header actions and the conflict banner;
// statuses are kept for every repository so changes can be shown per repo.
// Views call `run` / `runOp` for mutations so busy state, errors and
// refreshes are handled in one place.

import type { UnlistenFn } from "@tauri-apps/api/event";
import { api, errorMessage, onGitProgress, onRepoChanged, onWorkspaceChanged } from "$lib/api";
import type { OpOutcome, Refs, RepoInfo, RepoStatus, StashEntry } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { settings } from "./settings.svelte";
import { closeTabs, type FileTab, openTab, otherPaths, pathsToRight, pinTab, setTabDirty, type TabsState } from "./tabs";

/** "none" is the empty main area shown when the Log is toggled off and nothing else is open. */
export interface WorkspaceFolder {
  root: string;
  name: string;
  /** Repositories found in this folder (including one enclosing it). */
  repoRoots: string[];
}

/** One or more folders opened together, like a VS Code multi-root workspace. */
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

/** Wait after the last `.git` appearing or disappearing before rescanning, so a clone is scanned once. */
const RESCAN_DELAY_MS = 1000;

interface RunOptions<T> {
  /** Toast shown on success; a function receives the result. */
  success?: string | ((result: T) => string | null);
  /** Refresh the repository afterwards (default true). */
  refresh?: boolean;
  /** Repository to run in; defaults to the active one. */
  repoPath?: string;
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
  /** Label of the running operation, e.g. "Pushing". */
  busy = $state<string | null>(null);
  /** Latest progress line from fetch/pull/push. */
  progress = $state("");
  /** Incremented whenever HEAD or refs of the active repo may have changed; LogView reloads on change. */
  historyVersion = $state(0);
  /** Incremented when files anywhere in the workspace change; the file explorer reloads on change. */
  workspaceVersion = $state(0);
  view = $state<MainView>("diff");
  /** Conflicted path (in the active repository) open in the merge view. */
  mergeTarget = $state<string | null>(null);
  conflictsOpen = $state(false);
  /** Open editor tabs, in display order. */
  tabs = $state.raw<FileTab[]>([]);
  /** Absolute path of the active file tab. */
  openFilePath = $state<string | null>(null);
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

  private unlisteners: UnlistenFn[] = [];
  private inflight = new Map<string, Promise<void>>();
  private queued = new Set<string>();
  /** Repository whose stash list last failed to load, so the error shows once, not on every refresh. */
  private stashErrorRepo: string | null = null;
  private rescanTimer: ReturnType<typeof setTimeout> | undefined;

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

  /** Opens several folders as one workspace, replacing the current one. */
  async openFolders(folderPaths: string[], workspaceFile: string | null = null): Promise<boolean> {
    // Opening replaces the workspace and its tabs, so ask before anything changes.
    if (!(await this.confirmDiscardAll())) {
      return false;
    }
    const infos = [];
    for (const folderPath of folderPaths) {
      try {
        infos.push(await api.openWorkspace(folderPath));
      } catch (error) {
        toast.error(`Could not open ${folderPath}`, errorMessage(error));
      }
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
    await this.refreshAll();
    this.historyVersion++;
    await this.watchAll();
    this.unlisteners.push(
      await onRepoChanged((event) => {
        if (!this.repos.some((repo) => repo.root === event.repoPath)) {
          return;
        }
        void this.refreshRepo(event.repoPath, event.gitDir);
      }),
      await onWorkspaceChanged((event) => {
        if (this.workspace?.folders.some((folder) => folder.root === event.workspaceRoot)) {
          this.workspaceVersion++;
          if (event.reposChanged) {
            this.scheduleRescan();
          }
        }
      }),
      await onGitProgress((event) => {
        if (event.repoPath === this.repo?.root) {
          this.progress = event.line;
        }
      }),
    );
    return true;
  }

  /** Adds a folder to the open workspace (VS Code's "Add Folder to Workspace"). */
  async addFolder(folderPath: string): Promise<void> {
    if (!this.workspace) {
      await this.open(folderPath);
      return;
    }
    let info;
    try {
      info = await api.openWorkspace(folderPath);
    } catch (error) {
      toast.error("Could not add folder", errorMessage(error));
      return;
    }
    const added = info;
    if (this.workspace.folders.some((folder) => folder.root === added.root)) {
      toast.info(`${added.name} is already in the workspace`);
      return;
    }
    const folders = [...this.workspace.folders, { root: added.root, name: added.name, repoRoots: added.repos.map((repo) => repo.root) }];
    this.workspace = describeWorkspace(folders, this.workspace.file);
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
    this.workspaceVersion++;
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
    const prefix = folderRoot.endsWith("/") ? folderRoot : `${folderRoot}/`;
    const tabsInFolder = this.tabs.filter((tab) => tab.path.startsWith(prefix)).map((tab) => tab.path);
    if (tabsInFolder.length > 0 && !(await this.closeTabs(tabsInFolder))) {
      return;
    }
    await api.unwatchWorkspace(folderRoot).catch(() => undefined);
    const folders = workspace.folders.filter((folder) => folder.root !== folderRoot);
    this.workspace = describeWorkspace(folders, workspace.file);
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
    this.workspaceVersion++;
  }

  /** Opens a `.gitmanager-workspace` or VS Code `.code-workspace` file. */
  async openWorkspaceFile(filePath: string): Promise<boolean> {
    let saved;
    try {
      saved = await api.readWorkspaceFile(filePath);
    } catch (error) {
      toast.error("Could not open workspace file", errorMessage(error));
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
    return this.openFolders(saved.folders, filePath);
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

  /** Keeps a linked workspace file in step with the folder list, like VS Code. */
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
    this.repo = null;
    this.refs = null;
    this.stashes = [];
    this.mergeTarget = null;
    this.conflictsOpen = false;
    this.openFilePath = null;
    this.tabs = [];
    if (this.view === "file") {
      this.view = "diff";
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
    this.workspaceVersion++;
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
    await Promise.all([...this.repos.map((repo) => this.refreshRepoStatus(repo.root)), this.refreshActive()]);
  }

  /** Refreshes one repository after a change; the active one also reloads branches and stashes. */
  async refreshRepo(repoRoot: string, gitDirChanged = true): Promise<void> {
    const tasks = [this.refreshRepoStatus(repoRoot)];
    if (repoRoot === this.repo?.root && gitDirChanged) {
      this.historyVersion++;
      tasks.push(this.refreshActive());
    }
    await Promise.all(tasks);
  }

  refreshRepoStatus(repoRoot: string): Promise<void> {
    return this.coalesce(`status:${repoRoot}`, async () => {
      try {
        const status = await api.getStatus(repoRoot);
        if (this.repos.some((repo) => repo.root === repoRoot)) {
          this.statuses = { ...this.statuses, [repoRoot]: status };
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
        return;
      }
      const [refs, stashes] = await Promise.all([
        api.getRefs(repoRoot).catch((error) => {
          toast.error("Could not read branches", errorMessage(error));
          return null;
        }),
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
      ]);
      if (this.repo?.root === repoRoot) {
        this.refs = refs;
        this.stashes = stashes;
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
    try {
      const result = await work(repoPath);
      const message = typeof options.success === "function" ? options.success(result) : options.success;
      if (message) {
        toast.success(message);
      }
      return result;
    } catch (error) {
      toast.error(`${label} failed`, errorMessage(error));
      return undefined;
    } finally {
      this.busy = null;
      this.progress = "";
      if (options.refresh ?? true) {
        await this.refreshRepo(repoPath, true);
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

  /** The active file tab has unsaved edits. */
  get fileDirty(): boolean {
    return this.isDirty(this.openFilePath);
  }

  isDirty(filePath: string | null): boolean {
    return filePath !== null && this.tabs.some((tab) => tab.path === filePath && tab.dirty);
  }

  private get tabsState(): TabsState {
    return { tabs: this.tabs, active: this.openFilePath };
  }

  private applyTabs(next: TabsState): void {
    this.tabs = next.tabs;
    this.openFilePath = next.active;
    if (!next.active && this.view === "file") {
      this.view = "diff";
    }
  }

  /**
   * Opens a file by absolute path. A plain open uses the preview tab (a
   * single click); `pin` keeps the tab open (double click, or an explicit open).
   */
  async openFile(filePath: string, options: { pin?: boolean } = {}): Promise<void> {
    this.applyTabs(openTab(this.tabsState, filePath, options.pin ?? false));
    this.view = "file";
  }

  /** Makes a preview tab a normal tab. */
  pinFile(filePath: string): void {
    this.applyTabs(pinTab(this.tabsState, filePath));
  }

  /** The editor reports unsaved edits; editing also pins a preview tab. */
  setDirty(filePath: string, dirty: boolean): void {
    const next = setTabDirty(this.tabsState, filePath, dirty);
    if (next.tabs !== this.tabs) {
      this.tabs = next.tabs;
    }
  }

  /** Closes tabs, asking first when any of them has unsaved edits. */
  async closeTabs(filePaths: string[]): Promise<boolean> {
    const dirty = this.tabs.filter((tab) => filePaths.includes(tab.path) && tab.dirty);
    if (!(await this.confirmDiscard(dirty, dirty.length === 1 ? "Close it" : "Close them"))) {
      return false;
    }
    this.applyTabs(closeTabs(this.tabsState, filePaths));
    return true;
  }

  /** Before the whole workspace goes away (close, or opening another one). */
  private confirmDiscardAll(): Promise<boolean> {
    const dirty = this.tabs.filter((tab) => tab.dirty);
    const what = (this.workspace?.folders.length ?? 0) > 1 ? "workspace" : "folder";
    return this.confirmDiscard(dirty, `Close the ${what}`);
  }

  /** Asks before unsaved edits in `dirty` are thrown away; `action` starts the question, e.g. "Close it". */
  private async confirmDiscard(dirty: FileTab[], action: string): Promise<boolean> {
    if (dirty.length === 0) {
      return true;
    }
    const names = dirty.map((tab) => tab.path.slice(tab.path.lastIndexOf("/") + 1));
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

  closeTab(filePath: string): Promise<boolean> {
    return this.closeTabs([filePath]);
  }

  closeOtherTabs(filePath: string): Promise<boolean> {
    return this.closeTabs(otherPaths(this.tabsState, filePath));
  }

  closeTabsToRight(filePath: string): Promise<boolean> {
    return this.closeTabs(pathsToRight(this.tabsState, filePath));
  }

  closeAllTabs(): Promise<boolean> {
    return this.closeTabs(this.tabs.map((tab) => tab.path));
  }

  /** Closes the active file tab. */
  async closeFile(): Promise<void> {
    if (this.openFilePath) {
      await this.closeTab(this.openFilePath);
    }
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
