// Typed wrappers around the Tauri commands in src-tauri/src/commands.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppError,
  CommitDetails,
  CommitSummary,
  BlameInfo,
  ConflictSummary,
  DirListing,
  DiffArea,
  Eol,
  FileContent,
  FileDiff,
  GitOutput,
  GitProgressEvent,
  LaunchMode,
  MemoryUsage,
  MergeDocument,
  OpOutcome,
  OsInfo,
  Refs,
  RepoChangedEvent,
  RepoInfo,
  RepoStatus,
  ResetMode,
  Side,
  StashEntry,
  WorkspaceChangedEvent,
  WorkspaceFile,
  WorkspaceInfo,
} from "./types";

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
  commit: (repoPath: string, message: string, amend: boolean) =>
    invoke<GitOutput>("commit", { repoPath, message, amend }),
  getHeadMessage: (repoPath: string) => invoke<string>("get_head_message", { repoPath }),

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

  // Remote
  fetchAll: (repoPath: string) => invoke<OpOutcome>("fetch_all", { repoPath }),
  pull: (repoPath: string) => invoke<OpOutcome>("pull", { repoPath }),
  push: (repoPath: string, force: boolean) => invoke<OpOutcome>("push", { repoPath, force }),

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

  // Stash
  getStashes: (repoPath: string) => invoke<StashEntry[]>("get_stashes", { repoPath }),
  stashPush: (repoPath: string, message: string, includeUntracked: boolean) =>
    invoke<void>("stash_push", { repoPath, message, includeUntracked }),
  stashApply: (repoPath: string, stashIndex: number, pop: boolean) =>
    invoke<OpOutcome>("stash_apply", { repoPath, stashIndex, pop }),
  stashDrop: (repoPath: string, stashIndex: number) => invoke<void>("stash_drop", { repoPath, stashIndex }),

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
