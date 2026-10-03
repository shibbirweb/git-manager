// Typed wrappers around the Tauri commands in src-tauri/src/commands.

import { type Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppError,
  GitCommandEntry,
  IgnoreOutcome,
  IgnoreTarget,
  ShelfEntry,
  ShelfFileDiff,
  CommitDetails,
  CommitSummary,
  BlameInfo,
  ConflictSummary,
  DirListing,
  DiffArea,
  Eol,
  FileContent,
  FileDiff,
  PreviewSource,
  PreviewStat,
  FileHistoryEntry,
  FileSearchProgress,
  FileSearchResults,
  GitOutput,
  GitProgressEvent,
  LaunchMode,
  LineHistoryEntry,
  MemoryUsage,
  MemoryLogStatus,
  MergeDocument,
  NodeInstall,
  OpOutcome,
  OsInfo,
  OutgoingCommits,
  PatchSource,
  RebaseEntry,
  RebasePlan,
  PullMode,
  Refs,
  RemoteInfo,
  ReplaceOutcome,
  ReplaceRequest,
  RepoChangedEvent,
  RepoInfo,
  RepoStatus,
  ResetMode,
  RevisionDiff,
  ScriptSource,
  ShellProfile,
  Side,
  StashEntry,
  SymbolScope,
  SymbolSearchProgress,
  SymbolSearchResults,
  TerminalExitedEvent,
  TerminalInfo,
  TextSearchBatch,
  TextSearchOptions,
  WorkspaceChangedEvent,
  WorkspaceFile,
  WorkspaceInfo,
} from "./types";
import type {
  GhCliStatus,
  GitHubAccount,
  GitHubGist,
  GitHubGistRequest,
  GitHubRepositoryInfo,
  GitHubShareRequest,
  GitHubSharedRepository,
  GitHubSyncForkOutcome,
} from "./types";
import type { FileMove, LfsStatus, SubmoduleInfo, WorktreeBranch, WorktreeInfo } from "./types";
import type { BranchComparison, CommitOptions, MergeOptions, RebaseOptions, WorktreeComparison } from "./types";
import type { McpActivity, McpStatus, McpToolInfo, McpUiRequest, McpUiResult, McpUiToolDef } from "./types";

export function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as AppError).message ?? "Unknown error");
  }
  return String(error ?? "Unknown error");
}

export const api = {
  // Repository
  getLaunchMode: () => invoke<LaunchMode>("get_launch_mode"),
  openRepo: (repoPath: string) => invoke<RepoInfo>("open_repo", { repoPath }),

  // Workspace (a folder holding any number of repositories)
  openWorkspace: (folderPath: string) => invoke<WorkspaceInfo>("open_workspace", { folderPath }),
  discoverRepositories: (workspaceRoot: string) =>
    invoke<RepoInfo[]>("discover_repositories", { workspaceRoot }),
  initRepository: (folderPath: string) => invoke<RepoInfo>("init_repository", { folderPath }),
  watchWorkspace: (workspaceRoot: string, repoRoots: string[]) =>
    invoke<void>("watch_workspace", { workspaceRoot, repoRoots }),
  unwatchWorkspace: (workspaceRoot: string) => invoke<void>("unwatch_workspace", { workspaceRoot }),
  readWorkspaceFile: (filePath: string) => invoke<WorkspaceFile>("read_workspace_file", { filePath }),
  writeWorkspaceFile: (filePath: string, folders: string[]) =>
    invoke<void>("write_workspace_file", { filePath, folders }),

  // Status and commit
  getStatus: (repoPath: string) => invoke<RepoStatus>("get_status", { repoPath }),
  getFileDiff: (repoPath: string, filePath: string, origPath: string | null, area: DiffArea) =>
    invoke<FileDiff>("get_file_diff", { repoPath, filePath, origPath, area }),
  stageFiles: (repoPath: string, filePaths: string[]) => invoke<void>("stage_files", { repoPath, filePaths }),
  unstageFiles: (repoPath: string, filePaths: string[]) => invoke<void>("unstage_files", { repoPath, filePaths }),
  discardFiles: (repoPath: string, trackedPaths: string[], untrackedPaths: string[]) =>
    invoke<void>("discard_files", { repoPath, trackedPaths, untrackedPaths }),
  stageContent: (repoPath: string, filePath: string, content: string, eol: Eol) =>
    invoke<void>("stage_content", { repoPath, filePath, content, eol }),
  writeWorktreeFile: (repoPath: string, filePath: string, content: string, eol: Eol) =>
    invoke<void>("write_worktree_file", { repoPath, filePath, content, eol }),
  /** `options` (sign-off, author, GPG, skip hooks) null commits with the defaults. */
  commit: (repoPath: string, message: string, amend: boolean, options: CommitOptions | null = null) =>
    invoke<GitOutput>("commit", { repoPath, message, amend, options }),
  /** Stages every tracked change, then commits (`git commit --all`); untracked files stay out. */
  commitAll: (repoPath: string, message: string, amend: boolean, options: CommitOptions | null = null) =>
    invoke<GitOutput>("commit_all", { repoPath, message, amend, options }),
  /** `git reset --soft HEAD~1`; returns the undone commit's message. */
  undoLastCommit: (repoPath: string) => invoke<string>("undo_last_commit", { repoPath }),
  getHeadMessage: (repoPath: string) => invoke<string>("get_head_message", { repoPath }),
  /** Commits only `filePaths` (`git commit --only`), staging them first; other staged changes stay staged. */
  commitFiles: (repoPath: string, filePaths: string[], message: string, amend: boolean, options: CommitOptions | null = null) =>
    invoke<GitOutput>("commit_files", { repoPath, filePaths, message, amend, options }),
  /** JetBrains' Rollback: staged and unstaged changes of tracked files go back to HEAD; added files are unstaged (and deleted when asked). */
  rollbackFiles: (repoPath: string, filePaths: string[], deleteAdded: boolean) =>
    invoke<void>("rollback_files", { repoPath, filePaths, deleteAdded }),

  // Conflicts
  listConflicts: (repoPath: string) => invoke<ConflictSummary>("list_conflicts", { repoPath }),
  loadConflict: (repoPath: string, conflictPath: string, ignoreWhitespace: boolean) =>
    invoke<MergeDocument>("load_conflict", { repoPath, conflictPath, ignoreWhitespace }),
  saveResolution: (repoPath: string, conflictPath: string, content: string, eol: Eol) =>
    invoke<void>("save_resolution", { repoPath, conflictPath, content, eol }),
  acceptSide: (repoPath: string, conflictPaths: string[], side: Side) =>
    invoke<void>("accept_side", { repoPath, conflictPaths, side }),
  continueOperation: (repoPath: string) => invoke<OpOutcome>("continue_operation", { repoPath }),
  abortOperation: (repoPath: string) => invoke<OpOutcome>("abort_operation", { repoPath }),
  skipRebaseCommit: (repoPath: string) => invoke<OpOutcome>("skip_rebase_commit", { repoPath }),
  loadMergetool: (ignoreWhitespace: boolean) => invoke<MergeDocument>("load_mergetool", { ignoreWhitespace }),
  saveMergetool: (content: string, eol: Eol) => invoke<void>("save_mergetool", { content, eol }),
  cancelMergetool: () => invoke<void>("cancel_mergetool"),

  // Branches
  getRefs: (repoPath: string) => invoke<Refs>("get_refs", { repoPath }),
  checkoutBranch: (repoPath: string, branchName: string) => invoke<void>("checkout_branch", { repoPath, branchName }),
  checkoutRemoteBranch: (repoPath: string, remoteBranch: string, localName: string) =>
    invoke<void>("checkout_remote_branch", { repoPath, remoteBranch, localName }),
  createBranch: (repoPath: string, branchName: string, startPoint: string | null, checkout: boolean) =>
    invoke<void>("create_branch", { repoPath, branchName, startPoint, checkout }),
  renameBranch: (repoPath: string, branchName: string, newName: string) =>
    invoke<void>("rename_branch", { repoPath, branchName, newName }),
  deleteBranch: (repoPath: string, branchName: string, force: boolean) =>
    invoke<void>("delete_branch", { repoPath, branchName, force }),
  mergeBranch: (repoPath: string, branchName: string) => invoke<OpOutcome>("merge_branch", { repoPath, branchName }),
  rebaseOnto: (repoPath: string, branchName: string) => invoke<OpOutcome>("rebase_onto", { repoPath, branchName }),
  /** The Merge dialog: merges `branchName` into the current branch. */
  mergeWithOptions: (repoPath: string, branchName: string, options: MergeOptions) =>
    invoke<OpOutcome>("merge_with_options", { repoPath, branchName, options }),
  /** The Rebase dialog (not interactive). */
  rebaseWithOptions: (repoPath: string, options: RebaseOptions) => invoke<OpOutcome>("rebase_with_options", { repoPath, options }),
  /** Fetches and fast-forwards a branch that is not checked out from its upstream (`git fetch <remote> <upstream>:<branch>`). */
  updateBranch: (repoPath: string, branchName: string) => invoke<OpOutcome>("update_branch", { repoPath, branchName }),
  /** Pushes a local branch to its upstream, or publishes it to the default remote and tracks it. */
  pushBranch: (repoPath: string, branchName: string) => invoke<OpOutcome>("push_branch", { repoPath, branchName }),
  setBranchUpstream: (repoPath: string, branchName: string, upstream: string) =>
    invoke<void>("set_branch_upstream", { repoPath, branchName, upstream }),
  unsetBranchUpstream: (repoPath: string, branchName: string) => invoke<void>("unset_branch_upstream", { repoPath, branchName }),
  /** Commits only `branchName` has, commits only `baseName` has, and the files that differ. */
  compareBranches: (repoPath: string, branchName: string, baseName: string) =>
    invoke<BranchComparison>("compare_branches", { repoPath, branchName, baseName }),
  /** Files that differ between `revision` and the work tree (untracked files count as added). */
  compareWithWorktree: (repoPath: string, revision: string) =>
    invoke<WorktreeComparison>("compare_with_worktree", { repoPath, revision }),
  /** One file between two revisions: `fromRevision` left, `toRevision` right. */
  revisionsFileDiff: (repoPath: string, fromRevision: string, toRevision: string, filePath: string, origPath: string | null) =>
    invoke<FileDiff>("revisions_file_diff", { repoPath, fromRevision, toRevision, filePath, origPath }),

  // Remote
  /** Every remote, pruning deleted branches. */
  fetchAll: (repoPath: string) => invoke<OpOutcome>("fetch_all", { repoPath }),
  /** The default remote, optionally pruning deleted branches. */
  fetch: (repoPath: string, prune: boolean) => invoke<OpOutcome>("fetch", { repoPath, prune }),
  pull: (repoPath: string, rebase = false) => invoke<OpOutcome>("pull", { repoPath, rebase }),
  push: (repoPath: string, force: boolean) => invoke<OpOutcome>("push", { repoPath, force }),
  pushTags: (repoPath: string) => invoke<OpOutcome>("push_tags", { repoPath }),
  /** The Pull dialog: `remoteName` and `branchName` null pull the upstream; `noCommit` only applies to a merge. */
  pullWithOptions: (repoPath: string, remoteName: string | null, branchName: string | null, mode: PullMode, noCommit: boolean) =>
    invoke<OpOutcome>("pull_with_options", { repoPath, remoteName, branchName, mode, noCommit }),
  /** The Push dialog: pushes the current branch to `remoteName`/`remoteBranch`, setting the upstream when it has none. */
  pushWithOptions: (repoPath: string, remoteName: string, remoteBranch: string, forceWithLease: boolean, pushTags: boolean) =>
    invoke<OpOutcome>("push_with_options", { repoPath, remoteName, remoteBranch, forceWithLease, pushTags }),
  /** Commits of HEAD that are not on `remoteName`/`remoteBranch`, or on no remote when that branch does not exist. */
  outgoingCommits: (repoPath: string, remoteName: string, remoteBranch: string) =>
    invoke<OutgoingCommits>("outgoing_commits", { repoPath, remoteName, remoteBranch }),
  listRemotes: (repoPath: string) => invoke<RemoteInfo[]>("list_remotes", { repoPath }),
  addRemote: (repoPath: string, remoteName: string, fetchUrl: string, pushUrl: string | null) =>
    invoke<void>("add_remote", { repoPath, remoteName, fetchUrl, pushUrl }),
  /** Renames when `newName` differs, then sets the URLs; a null `pushUrl` pushes to the fetch URL. */
  editRemote: (repoPath: string, remoteName: string, newName: string, fetchUrl: string, pushUrl: string | null) =>
    invoke<void>("edit_remote", { repoPath, remoteName, newName, fetchUrl, pushUrl }),
  removeRemote: (repoPath: string, remoteName: string) => invoke<void>("remove_remote", { repoPath, remoteName }),
  /** `git clone --progress` into `parentDir`/`folderName` (missing or empty); progress lines arrive on `progress`. Resolves with the clone's path. */
  cloneRepository: (url: string, parentDir: string, folderName: string, progress: Channel<string>, cancelId: string | null = null) =>
    invoke<string>("clone_repository", { url, parentDir, folderName, progress, cancelId }),
  /** Stops the command started with `cancelId`; with a clone it fails with "Clone cancelled". False when none runs. */
  cancelGitCommand: (cancelId: string) => invoke<boolean>("cancel_git_command", { cancelId }),

  // Patches
  /** Writes `git diff --binary` of `source` (limited to `filePaths` when not empty) to `patchPath`; resolves with the file count. */
  createPatch: (repoPath: string, source: PatchSource, filePaths: string[], patchPath: string) =>
    invoke<number>("create_patch", { repoPath, source, filePaths, patchPath }),
  /** `git format-patch -1 --stdout` of a commit, written to `patchPath`. */
  createCommitPatch: (repoPath: string, commitId: string, patchPath: string) =>
    invoke<void>("create_commit_patch", { repoPath, commitId, patchPath }),
  /** Checks the patch (`git apply --check`), applies it to the work tree, else tries `git apply --3way`. */
  applyPatch: (repoPath: string, patchPath: string | null, patchText: string | null) =>
    invoke<OpOutcome>("apply_patch", { repoPath, patchPath, patchText }),
  readClipboardText: () => invoke<string>("read_clipboard_text"),

  // Tags (the list comes with getRefs)
  /** Annotated when `message` has text, lightweight otherwise; at HEAD unless `commitId` is given. */
  createTag: (repoPath: string, tagName: string, message: string | null, commitId: string | null = null) =>
    invoke<void>("create_tag", { repoPath, tagName, message, commitId }),
  deleteTag: (repoPath: string, tagName: string) => invoke<void>("delete_tag", { repoPath, tagName }),

  // History
  getLog: (repoPath: string, offset: number, limit: number, allRefs: boolean) =>
    invoke<CommitSummary[]>("get_log", { repoPath, offset, limit, allRefs }),
  getCommitDetails: (repoPath: string, commitId: string) =>
    invoke<CommitDetails>("get_commit_details", { repoPath, commitId }),
  getCommitFileDiff: (repoPath: string, commitId: string, filePath: string, origPath: string | null) =>
    invoke<FileDiff>("get_commit_file_diff", { repoPath, commitId, filePath, origPath }),
  blameFile: (repoPath: string, filePath: string, revision: string | null, contents: string | null) =>
    invoke<BlameInfo>("blame_file", { repoPath, filePath, revision, contents }),
  cherryPick: (repoPath: string, commitId: string) => invoke<OpOutcome>("cherry_pick", { repoPath, commitId }),
  revertCommit: (repoPath: string, commitId: string) => invoke<OpOutcome>("revert_commit", { repoPath, commitId }),
  resetTo: (repoPath: string, commitId: string, mode: ResetMode) =>
    invoke<void>("reset_to", { repoPath, commitId, mode }),
  checkoutCommit: (repoPath: string, commitId: string) => invoke<void>("checkout_commit", { repoPath, commitId }),
  /** The commits an interactive rebase from `fromCommit` (included) to HEAD rewrites. */
  rebasePlan: (repoPath: string, fromCommit: string) => invoke<RebasePlan>("rebase_plan", { repoPath, fromCommit }),
  /** The commits of `upstream`..HEAD for an interactive rebase onto `upstream`. */
  rebasePlanOnto: (repoPath: string, upstream: string) => invoke<RebasePlan>("rebase_plan_onto", { repoPath, upstream }),
  /** `git rebase -i` with the given todo, oldest first; `base` null rebases from the root. */
  interactiveRebase: (repoPath: string, base: string | null, entries: RebaseEntry[], autostash: boolean) =>
    invoke<OpOutcome>("interactive_rebase", { repoPath, base, entries, autostash }),
  /** The full commit id a revision (HEAD, a branch, a tag, a hash) points at. */
  resolveRevision: (repoPath: string, revision: string) => invoke<string>("resolve_revision", { repoPath, revision }),
  /** `git log --follow` of one file, newest first, with its path in each commit. */
  fileHistory: (repoPath: string, filePath: string, offset: number, limit: number) =>
    invoke<FileHistoryEntry[]>("file_history", { repoPath, filePath, offset, limit }),
  /** `git log -L startLine,endLine:filePath` (1-based, inclusive, lines of the HEAD version). */
  lineHistory: (repoPath: string, filePath: string, startLine: number, endLine: number, limit: number) =>
    invoke<LineHistoryEntry[]>("line_history", { repoPath, filePath, startLine, endLine, limit }),
  /** The file at `revision` against the work tree copy. */
  /** `origPath` is the old name of a renamed file, read from `revision`. */
  compareWithRevision: (repoPath: string, filePath: string, revision: string, origPath: string | null = null) =>
    invoke<RevisionDiff>("compare_with_revision", { repoPath, filePath, revision, origPath }),

  // Stash
  getStashes: (repoPath: string) => invoke<StashEntry[]>("get_stashes", { repoPath }),
  stashPush: (repoPath: string, message: string, includeUntracked: boolean) =>
    invoke<void>("stash_push", { repoPath, message, includeUntracked }),
  stashApply: (repoPath: string, stashIndex: number, pop: boolean) =>
    invoke<OpOutcome>("stash_apply", { repoPath, stashIndex, pop }),
  stashDrop: (repoPath: string, stashIndex: number) => invoke<void>("stash_drop", { repoPath, stashIndex }),
  stashClear: (repoPath: string) => invoke<void>("stash_clear", { repoPath }),

  // Worktrees
  listWorktrees: (repoPath: string) => invoke<WorktreeInfo[]>("list_worktrees", { repoPath }),
  /** `git worktree add`; resolves with the new work tree's path. */
  addWorktree: (repoPath: string, worktreePath: string, branch: WorktreeBranch) =>
    invoke<string>("add_worktree", { repoPath, worktreePath, branch }),
  removeWorktree: (repoPath: string, worktreePath: string, force: boolean) =>
    invoke<void>("remove_worktree", { repoPath, worktreePath, force }),
  lockWorktree: (repoPath: string, worktreePath: string, reason: string | null) =>
    invoke<void>("lock_worktree", { repoPath, worktreePath, reason }),
  unlockWorktree: (repoPath: string, worktreePath: string) => invoke<void>("unlock_worktree", { repoPath, worktreePath }),
  /** `git worktree prune --verbose`; resolves with git's report. */
  pruneWorktrees: (repoPath: string) => invoke<string>("prune_worktrees", { repoPath }),
  worktreeHasChanges: (worktreePath: string) => invoke<boolean>("worktree_has_changes", { worktreePath }),

  // Submodules (paths are relative to the parent repository)
  listSubmodules: (repoPath: string) => invoke<SubmoduleInfo[]>("list_submodules", { repoPath }),
  /** `git submodule init`; every submodule when `submodulePaths` is empty. */
  initSubmodules: (repoPath: string, submodulePaths: string[]) =>
    invoke<string>("init_submodules", { repoPath, submodulePaths }),
  /** `git submodule update --init --recursive [--remote]`; progress arrives as git-progress events. */
  updateSubmodules: (repoPath: string, remote: boolean, submodulePaths: string[]) =>
    invoke<string>("update_submodules", { repoPath, remote, submodulePaths }),
  syncSubmodules: (repoPath: string) => invoke<string>("sync_submodules", { repoPath }),
  addSubmodule: (repoPath: string, url: string, submodulePath: string, branchName: string | null) =>
    invoke<string>("add_submodule", { repoPath, url, submodulePath, branchName }),
  /** Deinit, `git rm` and its cloned repository under .git/modules. */
  removeSubmodule: (repoPath: string, submodulePath: string) => invoke<void>("remove_submodule", { repoPath, submodulePath }),

  // Git LFS
  /** `checkInstall` runs `git lfs version` again unless git-lfs is already known to be installed. */
  lfsStatus: (repoPath: string, checkInstall: boolean) => invoke<LfsStatus>("lfs_status", { repoPath, checkInstall }),
  lfsTrack: (repoPath: string, pattern: string) => invoke<string>("lfs_track", { repoPath, pattern }),
  lfsUntrack: (repoPath: string, pattern: string) => invoke<string>("lfs_untrack", { repoPath, pattern }),
  /** `git lfs pull` (`pull` true) or `git lfs fetch`; progress arrives as git-progress events. */
  lfsTransfer: (repoPath: string, pull: boolean) => invoke<string>("lfs_transfer", { repoPath, pull }),
  lfsPrune: (repoPath: string) => invoke<string>("lfs_prune", { repoPath }),
  lfsInstall: (repoPath: string) => invoke<string>("lfs_install", { repoPath }),

  // User config in ~/.gitmanager
  loadConfig: (configName: "settings" | "state") => invoke<unknown>("load_config", { configName }),
  saveConfig: (configName: "settings" | "state", value: unknown) => invoke<void>("save_config", { configName, value }),
  configDir: () => invoke<string>("config_dir"),
  memoryUsage: () => invoke<MemoryUsage>("memory_usage"),
  osInfo: () => invoke<OsInfo>("os_info"),

  // File explorer
  listDirectory: (rootPath: string, dirPath: string, repoRoots: string[]) =>
    invoke<DirListing>("list_directory", { rootPath, dirPath, repoRoots }),
  readWorktreeFile: (repoPath: string, filePath: string) =>
    invoke<FileContent>("read_worktree_file", { repoPath, filePath }),
  /** A local image for the Markdown preview as a data URL; `imagePath` is relative to the workspace folder `rootPath`. */
  readImageDataUrl: (rootPath: string, imagePath: string) => invoke<string>("read_image_data_url", { rootPath, imagePath }),
  /** Whether a previewed image or PDF is there, its size, and the limit when it is too big. */
  previewStat: (source: PreviewSource) =>
    invoke<PreviewStat>(
      "preview_stat",
      source.kind === "worktree"
        ? { filePath: source.filePath, repoRoot: null, revision: null }
        : { filePath: source.filePath, repoRoot: source.repoRoot, revision: source.revision },
    ),

  // File operations in the Files panel: absolute paths, each inside one of `workspaceRoots`.
  /** `name` may contain "/" to create nested folders; returns the new absolute path. */
  fileCreate: (workspaceRoots: string[], parentDir: string, name: string, isDir: boolean) =>
    invoke<string>("file_create", { workspaceRoots, parentDir, name, isDir }),
  /** Renames in place; `newName` is a single name. Returns the new absolute path. */
  fileRename: (workspaceRoots: string[], entryPath: string, newName: string) =>
    invoke<string>("file_rename", { workspaceRoots, entryPath, newName }),
  /** Copies into `targetDir`, using "name copy" names on conflicts. Returns the new paths in source order. */
  fileCopy: (workspaceRoots: string[], sourcePaths: string[], targetDir: string) =>
    invoke<string[]>("file_copy", { workspaceRoots, sourcePaths, targetDir }),
  /** Moves into `targetDir`; entries already there are skipped. Returns each moved entry. */
  fileMove: (workspaceRoots: string[], sourcePaths: string[], targetDir: string) =>
    invoke<FileMove[]>("file_move", { workspaceRoots, sourcePaths, targetDir }),
  fileTrash: (workspaceRoots: string[], entryPaths: string[]) => invoke<void>("file_trash", { workspaceRoots, entryPaths }),
  /** Which absolute paths are files inside the workspace folders (the terminal's clickable paths); never fails. */
  filesExist: (workspaceRoots: string[], filePaths: string[]) => invoke<boolean[]>("files_exist", { workspaceRoots, filePaths }),

  // Go to File. Indexing progress arrives on `progress` until the popup closes.
  fileSearchOpen: (workspaceRoots: string[], progress: Channel<FileSearchProgress>) =>
    invoke<FileSearchProgress>("file_search_open", { workspaceRoots, progress }),
  fileSearchQuery: (workspaceRoots: string[], query: string, limit: number) =>
    invoke<FileSearchResults>("file_search_query", { workspaceRoots, query, limit }),
  fileSearchClose: () => invoke<void>("file_search_close"),
  // Classes and Symbols: the symbol index is built on first use; progress arrives until the popup closes.
  symbolSearchOpen: (workspaceRoots: string[], progress: Channel<SymbolSearchProgress>) =>
    invoke<SymbolSearchProgress>("symbol_search_open", { workspaceRoots, progress }),
  symbolSearchQuery: (workspaceRoots: string[], query: string, scope: SymbolScope, limit: number) =>
    invoke<SymbolSearchResults>("symbol_search_query", { workspaceRoots, query, scope, limit }),
  // Find in Files: batches stream on `results`; a newer `searchId` stops the previous search.
  textSearch: (
    workspaceRoots: string[],
    searchId: number,
    query: string,
    options: TextSearchOptions,
    results: Channel<TextSearchBatch>,
  ) => invoke<void>("text_search", { workspaceRoots, searchId, query, options, results }),
  textSearchCancel: (searchId: number) => invoke<void>("text_search_cancel", { searchId }),
  // Replace in Files (or a preview count); a newer `replaceId` or a cancel stops it between files.
  replaceInFiles: (workspaceRoots: string[], replaceId: number, request: ReplaceRequest) =>
    invoke<ReplaceOutcome>("replace_in_files", { workspaceRoots, replaceId, request }),
  replaceInFilesCancel: (replaceId: number) => invoke<void>("replace_in_files_cancel", { replaceId }),

  // Integrated terminal. Output arrives as raw bytes on `output`; exit as a "terminal-exited" event.
  terminalShells: () => invoke<ShellProfile[]>("terminal_shells"),
  terminalSpawn: (
    options: { shellId: string | null; cwd: string | null; cols: number; rows: number },
    output: Channel<ArrayBuffer>,
  ) => invoke<TerminalInfo>("terminal_spawn", { ...options, output }),
  terminalWrite: (terminalId: number, data: string) => invoke<void>("terminal_write", { terminalId, data }),
  terminalResize: (terminalId: number, cols: number, rows: number) =>
    invoke<void>("terminal_resize", { terminalId, cols, rows }),
  terminalClose: (terminalId: number) => invoke<void>("terminal_close", { terminalId }),
  /** Closes every terminal, e.g. left over after a reload of the window. */
  terminalCloseAll: () => invoke<void>("terminal_close_all"),

  // Git Console: the git commands the app ran. The first call starts the "git-command" events.
  gitConsoleEntries: () => invoke<GitCommandEntry[]>("git_console_entries"),
  gitConsoleClear: () => invoke<void>("git_console_clear"),
  gitConsoleSetEnabled: (enabled: boolean) => invoke<void>("git_console_set_enabled", { enabled }),

  // Scripts tool window: package.json, composer.json, Makefile, deno.json and justfile scripts.
  listProjectScripts: (folderPaths: string[]) => invoke<ScriptSource[]>("list_project_scripts", { folderPaths }),
  listNodeVersions: () => invoke<NodeInstall[]>("list_node_versions"),
  // Debug memory log: memory readings and UI events in ~/.gitmanager/logs/memory.log.
  memoryLogConfigure: (enabled: boolean, intervalMs: number, thresholdMb: number) =>
    invoke<MemoryLogStatus>("memory_log_configure", { enabled, intervalMs, thresholdMb }),
  memoryLogEvent: (label: string) => invoke<void>("memory_log_event", { label }),
  /** A script as its own process (the Run tab); output and exit arrive like a terminal's. */
  runScript: (
    options: { program: string; args: string[]; cwd: string; nodeBinDir: string | null; cols: number; rows: number },
    output: Channel<ArrayBuffer>,
  ) => invoke<TerminalInfo>("run_script", { ...options, output }),

  // Shelf (.git/gitmanager-shelf). `filePaths` null unshelves every file.
  shelveChanges: (repoPath: string, name: string, filePaths: string[], keepInWorkingTree: boolean) =>
    invoke<ShelfEntry>("shelve_changes", { repoPath, name, filePaths, keepInWorkingTree }),
  listShelf: (repoPath: string) => invoke<ShelfEntry[]>("list_shelf", { repoPath }),
  unshelve: (repoPath: string, shelfId: string, filePaths: string[] | null, removeFromShelf: boolean) =>
    invoke<OpOutcome>("unshelve", { repoPath, shelfId, filePaths, removeFromShelf }),
  shelfFileDiff: (repoPath: string, shelfId: string, filePath: string) =>
    invoke<ShelfFileDiff>("shelf_file_diff", { repoPath, shelfId, filePath }),
  renameShelf: (repoPath: string, shelfId: string, name: string) =>
    invoke<ShelfEntry>("rename_shelf", { repoPath, shelfId, name }),
  deleteShelf: (repoPath: string, shelfId: string) => invoke<void>("delete_shelf", { repoPath, shelfId }),

  // Add to .gitignore / .git/info/exclude; `filePaths` are the files the patterns were made for.
  addToIgnore: (repoPath: string, patterns: string[], target: IgnoreTarget, filePaths: string[]) =>
    invoke<IgnoreOutcome>("add_to_ignore", { repoPath, patterns, target, filePaths }),
  ensureIgnoreFile: (repoPath: string, target: IgnoreTarget) => invoke<string>("ensure_ignore_file", { repoPath, target }),
  untrackFiles: (repoPath: string, filePaths: string[]) => invoke<void>("untrack_files", { repoPath, filePaths }),

  // GitHub account (src-tauri/src/github). The token goes in once and never comes back.
  /** The signed-in account from ~/.gitmanager/github.json; no network, no keychain. */
  githubAccount: () => invoke<GitHubAccount | null>("github_account"),
  githubCliStatus: () => invoke<GhCliStatus>("github_cli_status"),
  /** Verifies the token with GitHub, then keeps it only in the system keychain. */
  githubSignInWithToken: (token: string) => invoke<GitHubAccount>("github_sign_in_with_token", { token }),
  /** Uses `gh auth token` on demand; nothing is stored but the login. */
  githubSignInWithCli: () => invoke<GitHubAccount>("github_sign_in_with_cli"),
  githubSignOut: () => invoke<void>("github_sign_out"),
  /** Creates the repository on GitHub and adds it as a remote (committing first when asked); push next. */
  githubShareProject: (repoPath: string, request: GitHubShareRequest) =>
    invoke<GitHubSharedRepository>("github_share_project", { repoPath, request }),
  githubRepository: (owner: string, repo: string) => invoke<GitHubRepositoryInfo>("github_repository", { owner, repo }),
  githubSyncFork: (owner: string, repo: string, branchName: string) =>
    invoke<GitHubSyncForkOutcome>("github_sync_fork", { owner, repo, branchName }),
  githubCreateGist: (request: GitHubGistRequest) => invoke<GitHubGist>("github_create_gist", { request }),

  // MCP server and command line tool (src-tauri/src/mcp). Both off: nothing listens.
  /** Starts, restarts or stops the local server; `toolStates` holds only the tools switched from their default. */
  mcpConfigure: (enabled: boolean, cliEnabled: boolean, port: number, toolStates: Record<string, boolean>) =>
    invoke<McpStatus>("mcp_configure", { enabled, cliEnabled, port, toolStates }),
  mcpStatus: () => invoke<McpStatus>("mcp_status"),
  /** Backend and registered UI tools, with their effective enabled state. */
  mcpTools: () => invoke<McpToolInfo[]>("mcp_tools"),
  mcpRegisterUiTools: (tools: McpUiToolDef[]) => invoke<void>("mcp_register_ui_tools", { tools }),
  /** The folders tools may touch: the workspace folders open now. */
  mcpSetWorkspace: (folderPaths: string[]) => invoke<void>("mcp_set_workspace", { folderPaths }),
  mcpUiRespond: (requestId: number, result: McpUiResult) => invoke<void>("mcp_ui_respond", { requestId, result }),
  /** A new secret token; connected tools need the new one. */
  mcpRegenerateToken: () => invoke<McpStatus>("mcp_regenerate_token"),
  /** The last 50 calls, newest last. */
  mcpActivity: () => invoke<McpActivity[]>("mcp_activity"),
  /** Links `git-manager` in ~/.local/bin (not supported on Windows yet). */
  cliInstall: () => invoke<McpStatus>("cli_install"),
  cliUninstall: () => invoke<McpStatus>("cli_uninstall"),
};

export function onRepoChanged(handler: (event: RepoChangedEvent) => void): Promise<UnlistenFn> {
  return listen<RepoChangedEvent>("repo-changed", (event) => handler(event.payload));
}

export function onWorkspaceChanged(handler: (event: WorkspaceChangedEvent) => void): Promise<UnlistenFn> {
  return listen<WorkspaceChangedEvent>("workspace-changed", (event) => handler(event.payload));
}

export function onGitProgress(handler: (event: GitProgressEvent) => void): Promise<UnlistenFn> {
  return listen<GitProgressEvent>("git-progress", (event) => handler(event.payload));
}

export function onTerminalExited(handler: (event: TerminalExitedEvent) => void): Promise<UnlistenFn> {
  return listen<TerminalExitedEvent>("terminal-exited", (event) => handler(event.payload));
}

/** A git command started or finished (Git Console). Sent once `gitConsoleEntries` was called. */
export function onGitCommand(handler: (entry: GitCommandEntry) => void): Promise<UnlistenFn> {
  return listen<GitCommandEntry>("git-command", (event) => handler(event.payload));
}

/** A tool call for a UI tool; every request must be answered with `api.mcpUiRespond`. */
export function onMcpUiRequest(handler: (request: McpUiRequest) => void): Promise<UnlistenFn> {
  return listen<McpUiRequest>("mcp-ui-request", (event) => handler(event.payload));
}

/** A tool call finished (MCP or CLI), for the live Recent calls list. */
export function onMcpActivity(handler: (activity: McpActivity) => void): Promise<UnlistenFn> {
  return listen<McpActivity>("mcp-activity", (event) => handler(event.payload));
}
