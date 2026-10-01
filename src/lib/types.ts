// TypeScript mirrors of the Rust DTOs (serde camelCase).

export type Eol = "lf" | "crlf";

export interface AppError {
  kind: "git" | "io" | "command" | "invalid";
  message: string;
}

export type LaunchMode =
  | { mode: "app"; repoPath: string | null }
  | { mode: "mergeTool"; base: string; local: string; remote: string; merged: string };

export interface RepoInfo {
  root: string;
  name: string;
  /** Repo root relative to the workspace root; "" for the root itself or an enclosing repo. */
  relativePath: string;
}

/** A saved `.gitmanager-workspace` (or VS Code `.code-workspace`) file. */
export interface WorkspaceFile {
  name: string;
  folders: string[];
  /** Listed folders that no longer exist. */
  missing: string[];
}

export interface WorkspaceInfo {
  root: string;
  name: string;
  repos: RepoInfo[];
}

export type ChangeKind = "added" | "modified" | "deleted" | "renamed" | "typechange" | "untracked";

export interface FileStatus {
  path: string;
  origPath: string | null;
  staged: ChangeKind | null;
  unstaged: ChangeKind | null;
  conflicted: boolean;
}

export interface HeadInfo {
  branch: string | null;
  shortId: string | null;
  unborn: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export type OpKind = "none" | "merge" | "rebase" | "cherryPick" | "revert" | "other";

export interface OpState {
  kind: OpKind;
  description: string;
  oursLabel: string;
  theirsLabel: string;
}

export interface RepoStatus {
  head: HeadInfo;
  op: OpState;
  files: FileStatus[];
}

export type DiffArea = "staged" | "unstaged";

export interface FileDiff {
  path: string;
  original: string;
  modified: string;
  originalEol: Eol;
  modifiedEol: Eol;
  binary: boolean;
  tooLarge: boolean;
}

export interface GitOutput {
  stdout: string;
  stderr: string;
  success: boolean;
}

export interface OpOutcome {
  output: string;
  conflicts: boolean;
}

// Merge

export interface LineRange {
  start: number;
  end: number;
}

export type ChunkKind = "oursOnly" | "theirsOnly" | "bothSame" | "conflict";

export interface MergeChunk {
  id: number;
  kind: ChunkKind;
  base: LineRange;
  ours: LineRange;
  theirs: LineRange;
}

export type FileConflictKind = "bothModified" | "bothAdded" | "deletedByUs" | "deletedByThem";

export interface MergeDocument {
  path: string;
  kind: FileConflictKind;
  binary: boolean;
  base: string;
  ours: string;
  theirs: string;
  oursLabel: string;
  theirsLabel: string;
  eol: Eol;
  ignoreWhitespace: boolean;
  chunks: MergeChunk[];
}

export interface ConflictFile {
  path: string;
  kind: FileConflictKind;
  binary: boolean;
}

export interface ConflictSummary {
  op: OpState;
  files: ConflictFile[];
}

export type Side = "ours" | "theirs";

// Refs, log, stash

export interface LocalBranch {
  name: string;
  isHead: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  shortId: string | null;
}

export interface RemoteBranch {
  name: string;
  remote: string;
  branch: string;
}

export interface Refs {
  local: LocalBranch[];
  remote: RemoteBranch[];
  tags: string[];
  remotes: string[];
}

export type RefKind = "head" | "local" | "remote" | "tag";

export interface RefLabel {
  name: string;
  kind: RefKind;
}

export interface CommitSummary {
  id: string;
  shortId: string;
  summary: string;
  authorName: string;
  authorEmail: string;
  time: number;
  parents: string[];
  refs: RefLabel[];
}

export interface ChangedFile {
  path: string;
  origPath: string | null;
  status: "added" | "deleted" | "renamed" | "copied" | "typechange" | "modified";
}

export interface CommitDetails {
  id: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authorTime: number;
  committerName: string;
  committerTime: number;
  parents: string[];
  files: ChangedFile[];
}

export interface StashEntry {
  index: number;
  message: string;
  shortId: string;
}

export type ResetMode = "soft" | "mixed" | "hard";

// Blame

export interface BlameCommit {
  id: string;
  shortId: string;
  authorName: string;
  authorEmail: string;
  /** Seconds since the epoch. */
  authorTime: number;
  summary: string;
  uncommitted: boolean;
}

export interface BlameInfo {
  commits: BlameCommit[];
  /** Commit index for every 0-based line. */
  lines: number[];
  /** For every 0-based line, its 0-based line in the commit that last changed it. */
  originalLines?: number[];
}

// Memory

export interface ProcessMemory {
  pid: number;
  name: string;
  label: string;
  bytes: number;
}

export interface MemoryUsage {
  totalBytes: number;
  processes: ProcessMemory[];
  /** Web view helpers matched by start time (the app was started from a terminal). */
  approximate: boolean;
}

/** The real OS for bug reports; the web view's user agent freezes the macOS version. */
export interface OsInfo {
  /** "macOS", "Windows", or the Linux distribution name. */
  name: string;
  version: string | null;
}

// File explorer

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  ignored: boolean;
  /** The folder is the root of a git repository. */
  isRepo: boolean;
}

export interface DirListing {
  entries: DirEntry[];
  truncated: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  eol: Eol;
  binary: boolean;
  tooLarge: boolean;
  size: number;
}

// Events

export interface RepoChangedEvent {
  repoPath: string;
  gitDir: boolean;
  workTree: boolean;
}

export interface WorkspaceChangedEvent {
  workspaceRoot: string;
  /** A repository may have appeared or disappeared, so the folder should be rescanned. */
  reposChanged: boolean;
}

export interface GitProgressEvent {
  repoPath: string;
  line: string;
}
