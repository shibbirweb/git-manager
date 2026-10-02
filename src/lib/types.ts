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
  /** A submodule of the repository enclosing it. */
  submodule?: boolean;
  /** A linked work tree (`git worktree add`). */
  worktree?: boolean;
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
  /** Set for a submodule: what changed in it, like `git status`. */
  submodule?: SubmoduleChange | null;
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
  /** Set when either side is a Git LFS pointer. */
  lfs?: LfsDiff | null;
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

export type ResetMode = "soft" | "mixed" | "hard" | "keep";

// Git menu: pull, push, patches, remotes, clone, file history

/** How a pull integrates: a merge (--no-rebase), a rebase or a fast-forward only. */
export type PullMode = "merge" | "rebase" | "ffOnly";

/** Commits the current branch would push. */
export interface OutgoingCommits {
  commits: CommitSummary[];
  /** The remote branch they are counted against, e.g. "origin/main"; null when it does not exist yet (every commit on no remote). */
  base: string | null;
  /** More commits than were listed. */
  truncated: boolean;
}

/** Which changes a patch holds: staged (HEAD to index), unstaged (index to work tree) or both (HEAD to work tree). */
export type PatchSource = "staged" | "unstaged" | "all";

export interface RemoteInfo {
  name: string;
  fetchUrl: string | null;
  /** The push URL; equals `fetchUrl` unless a separate one is configured. */
  pushUrl: string | null;
  /** The remote's default branch from refs/remotes/NAME/HEAD, e.g. "main"; null when unknown. */
  defaultBranch: string | null;
}

export interface FileHistoryEntry {
  commit: CommitSummary;
  /** The file's repo-relative path in this commit (it changes across renames). */
  path: string;
  origPath: string | null;
  status: "added" | "deleted" | "renamed" | "copied" | "typechange" | "modified";
}

export interface LineHistoryEntry {
  commit: CommitSummary;
  /** The commit's diff of the traced lines (`git log -L`), possibly cut short. */
  patch: string;
  truncated: boolean;
}

// Interactive rebase

export type RebaseAction = "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";

export interface RebaseCommit {
  id: string;
  shortId: string;
  summary: string;
  /** The full message. */
  message: string;
  authorName: string;
  authorEmail: string;
  time: number;
  isMerge: boolean;
}

export interface RebasePlan {
  /** Oldest first: base..HEAD. */
  commits: RebaseCommit[];
  /** The parent commit the rebase starts on; null rebases from the root. */
  base: string | null;
  /** A remote branch (the upstream first) that already has commits of the range. */
  pushedTo: string | null;
  /** Uncommitted changes to tracked files. */
  dirty: boolean;
  /** The todo with its label, reset and merge lines when the range has merges (`--rebase-merges`); empty when linear. */
  steps: RebaseStep[];
  /** A branch the commits go onto (the Rebase dialog's --interactive), for the title; null names the base commit. */
  ontoName: string | null;
}

export type RebaseStepKind = "label" | "reset" | "pick" | "merge";

/** One line of a todo that keeps merges. */
export interface RebaseStep {
  kind: RebaseStepKind;
  /** Pick and merge: the commit. Reset: the commit it resets to (also set with a label, except for "onto"). */
  commitId: string | null;
  /** Label: its name. Reset: the label it resets to. */
  label: string | null;
  /** Merge: labels (or commit ids outside the range) of the parents merged in. */
  parents: string[];
}

export interface RebaseEntry {
  action: RebaseAction;
  commitId: string;
  /** Reword: the new message; squash: the combined message of its group. */
  message: string | null;
}

/** A file at a revision (left) against the work tree (right). */
export interface RevisionDiff {
  diff: FileDiff;
  existsInRevision: boolean;
  /** The full id of the commit the revision resolved to. */
  commitId: string;
}

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

// Integrated terminal

/** Where a project's scripts come from (src-tauri/src/scripts). */
export type ScriptKind = "npm" | "composer" | "make" | "deno" | "just";

/** One file with runnable scripts: package.json, composer.json, a Makefile, deno.json or a justfile. */
export interface ScriptSource {
  kind: ScriptKind;
  /** Absolute path of the file. */
  filePath: string;
  /** Absolute folder the scripts run in. */
  folderPath: string;
  /** The workspace folder it was found under. */
  workspaceFolder: string;
  /** Program that runs it: npm, yarn, pnpm or bun for package.json, else composer, make, deno or just. */
  runner: string;
  packageName: string | null;
  scripts: ProjectScript[];
  /** Why the file could not be read; its scripts are then empty. */
  error: string | null;
  /** package.json only: the Node version the project asks for, if it says. */
  nodeVersion: NodeWanted | null;
}

/** A Node version asked for by .nvmrc, .node-version, .tool-versions or package.json. */
export interface NodeWanted {
  /** As written: "18", "v20.11.1", "lts/iron", ">=18 <21". */
  spec: string;
  /** ".nvmrc", "package.json engines.node"... */
  source: string;
  filePath: string;
}

/** A Node version installed by a version manager (src-tauri/src/node_versions.rs). */
export interface NodeInstall {
  /** "20.11.1", without the v. */
  version: string;
  /** Put first on PATH to use this version. */
  binDir: string;
  /** "nvm", "Herd", "fnm", "Volta", "asdf", "mise", "nodenv", "n" or "Homebrew". */
  manager: string;
}

export interface ProjectScript {
  name: string;
  /** What it runs, for the tooltip. */
  command: string;
  /** 1-based line of its name in the file; 0 when unknown. */
  line: number;
}

/** A shell the terminal can start, found on this machine (src-tauri/src/terminal.rs). */
export interface ShellProfile {
  /** Stable id, the shell's absolute path, e.g. "/bin/zsh". */
  id: string;
  /** Short name shown in menus and tabs, e.g. "zsh", "bash", "PowerShell". */
  name: string;
  path: string;
  /** Arguments it starts with, e.g. ["-l"] for a login shell. */
  args: string[];
  /** The user's login shell ($SHELL), used when no default is set. */
  isDefault: boolean;
}

export interface TerminalInfo {
  terminalId: number;
  /** Process id of the shell, when the platform reports one. */
  pid: number | null;
  shell: ShellProfile;
  /** The folder it started in. */
  cwd: string;
}

/** Sent once when a terminal's shell exits (or was closed). */
export interface TerminalExitedEvent {
  terminalId: number;
  /** null when the process was killed or the code is unknown. */
  exitCode: number | null;
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

/** One entry moved by `file_move`: absolute paths before and after. */
export interface FileMove {
  from: string;
  to: string;
}

export interface FileContent {
  path: string;
  content: string;
  eol: Eol;
  binary: boolean;
  tooLarge: boolean;
  size: number;
}

// Go to File

export interface FileSearchProgress {
  indexed: number;
  done: boolean;
  /** Indexing stopped at the file cap. */
  truncated: boolean;
}

export interface FileSearchItem {
  /** Absolute path. */
  path: string;
  /** Workspace folder the file was found in. */
  root: string;
  relativePath: string;
  /** Matched code points of `relativePath`, ascending. */
  indices: number[];
  score: number;
}

export interface FileSearchResults {
  items: FileSearchItem[];
  /** Every file that matched; `items` holds the best of them. */
  matched: number;
  indexed: number;
  done: boolean;
  truncated: boolean;
  /** 1-based, from a "name:LINE:COL" query. */
  line: number | null;
  column: number | null;
}

// Search Everywhere: Classes and Symbols

export type SymbolKind =
  | "class"
  | "interface"
  | "trait"
  | "struct"
  | "enum"
  | "type"
  | "protocol"
  | "record"
  | "object"
  | "module"
  | "function"
  | "method"
  | "constant";

/** Which definitions a symbol query lists; "members" is everything but classes. */
export type SymbolScope = "classes" | "all" | "members";

export interface SymbolSearchProgress {
  /** Files looked at so far. */
  files: number;
  symbols: number;
  done: boolean;
  /** Indexing stopped at the symbol cap. */
  truncated: boolean;
}

export interface SymbolSearchItem {
  name: string;
  kind: SymbolKind;
  container: string | null;
  /** Absolute path. */
  path: string;
  root: string;
  relativePath: string;
  /** 1-based. */
  line: number;
  /** 1-based, in UTF-16 code units. */
  column: number;
  /** Matched code points of `name`, ascending. */
  indices: number[];
  /** Matched code points of `container` ("Cart.add" queries). */
  containerIndices: number[];
  score: number;
}

export interface SymbolSearchResults {
  items: SymbolSearchItem[];
  matched: number;
  files: number;
  symbols: number;
  done: boolean;
  truncated: boolean;
}

// Search Everywhere: Text (Find in Files)

export interface TextSearchOptions {
  matchCase: boolean;
  wholeWords: boolean;
  regex: boolean;
}

export interface TextLineMatch {
  /** 1-based. */
  line: number;
  /** 1-based column of the first match, in UTF-16 code units. */
  column: number;
  /** The line, trimmed around the first match. */
  text: string;
  /** Matches in `text` as UTF-16 [start, end) offsets. */
  ranges: [number, number][];
}

export interface TextFileMatches {
  /** Absolute path. */
  path: string;
  root: string;
  relativePath: string;
  lines: TextLineMatch[];
}

export interface TextSearchBatch {
  /** Files found since the previous batch. */
  files: TextFileMatches[];
  /** The last batch of this search. */
  done: boolean;
  /** Matching lines so far. */
  matches: number;
  filesMatched: number;
  filesSearched: number;
  /** The caps were hit: there are more results than sent. */
  more: boolean;
  error: string | null;
}

// Search Everywhere: Replace in Files

export interface ReplaceRequest {
  query: string;
  options: TextSearchOptions;
  /** Literal, or with Regex on: $1 groups, $& the match, $$ a dollar, and \n \t \r \\ escapes. */
  replacement: string;
  /** Absolute paths to limit the replace to; null replaces in every file. */
  filePaths: string[] | null;
  /** Absolute paths never written (open with unsaved edits). */
  skipPaths: string[];
  /** Only count what would be replaced. */
  preview: boolean;
}

export interface ReplacedFile {
  /** Absolute path. */
  path: string;
  root: string;
  relativePath: string;
  replacements: number;
}

export type ReplaceSkipReason = "unsaved" | "link" | "readOnly";

export interface ReplaceSkippedFile {
  path: string;
  relativePath: string;
  reason: ReplaceSkipReason;
  matches: number;
}

export interface ReplaceFailedFile {
  path: string;
  relativePath: string;
  message: string;
}

export interface ReplaceOutcome {
  files: ReplacedFile[];
  /** Matches replaced in `files`. */
  replacements: number;
  skipped: ReplaceSkippedFile[];
  failed: ReplaceFailedFile[];
  /** Stopped by a cancel; `files` holds what was done. */
  cancelled: boolean;
  preview: boolean;
  /** The query could not be used (an invalid regex). */
  error: string | null;
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

// GitHub (src-tauri/src/github)

export type GitHubAccountSource = "token" | "ghCli";

/** The signed-in GitHub account. The token itself never reaches the webview. */
export interface GitHubAccount {
  host: string;
  login: string;
  name: string | null;
  source: GitHubAccountSource;
  /** Scopes a classic token lacks ("repo", "gist"); empty when unknown. */
  missingScopes: string[];
}

export interface GhCliStatus {
  installed: boolean;
  signedIn: boolean;
}

export interface GitHubShareRequest {
  repositoryName: string;
  private: boolean;
  description: string;
  remoteName: string;
  /** For a repository without commits: commit every file with this message first. */
  initialCommitMessage: string | null;
}

export interface GitHubSharedRepository {
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  remoteName: string;
  branchName: string;
}

export interface GitHubRepositoryInfo {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string | null;
  fork: boolean;
  parent: { fullName: string; owner: string; repo: string; defaultBranch: string | null } | null;
}

export type GitHubSyncKind = "fastForward" | "merge" | "upToDate" | "conflict";

export interface GitHubSyncForkOutcome {
  kind: GitHubSyncKind;
  message: string;
  /** The upstream branch, e.g. "octo:main". */
  baseBranch: string | null;
}

export interface GitHubGistRequest {
  fileName: string;
  description: string;
  public: boolean;
  content: string;
}

export interface GitHubGist {
  id: string;
  htmlUrl: string;
}

// Worktrees, submodules and Git LFS

export interface WorktreeInfo {
  path: string;
  /** Full commit id; null for a bare entry or an unborn branch. */
  head: string | null;
  /** Short branch name; null when detached or bare. */
  branch: string | null;
  detached: boolean;
  bare: boolean;
  locked: boolean;
  lockReason: string | null;
  /** Its folder is gone: Prune removes it. */
  prunable: boolean;
  prunableReason: string | null;
  isMain: boolean;
  /** The work tree the list was read from. */
  isCurrent: boolean;
}

/** What a new worktree checks out. */
export type WorktreeBranch =
  | { kind: "existing"; branchName: string }
  | { kind: "new"; branchName: string; baseRef: string }
  | { kind: "detached"; baseRef: string };

export interface SubmoduleChange {
  newCommits: boolean;
  modifiedContent: boolean;
  untrackedContent: boolean;
}

export interface SubmoduleInfo {
  name: string;
  /** Relative to the parent repository's root. */
  path: string;
  url: string | null;
  branch: string | null;
  initialized: boolean;
  recordedId: string | null;
  checkedOutId: string | null;
}

export interface LfsStatus {
  /** `git lfs version` output; null when git-lfs is not installed or was not checked yet. */
  version: string | null;
  /** Some attributes file routes paths through LFS. */
  used: boolean;
  /** The LFS patterns of the root `.gitattributes`. */
  patterns: string[];
  /** Repo-relative paths stored in LFS. */
  files: string[];
}

export interface LfsDiff {
  originalSize: number | null;
  modifiedSize: number | null;
  originalOid: string | null;
  modifiedOid: string | null;
}

// Git Console

/** A git command the app ran (git/cli.rs), credentials masked. */
export interface GitCommandEntry {
  id: number;
  /** Milliseconds since the epoch. */
  startedAt: number;
  repoPath: string;
  /** The arguments after `git`. */
  args: string[];
  running: boolean;
  durationMs: number | null;
  exitCode: number | null;
  success: boolean;
  /** Why git could not run at all. */
  error: string | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

// Shelf

export type ShelvedChange = "added" | "modified" | "deleted" | "renamed" | "copied" | "typechange";

export interface ShelvedFile {
  path: string;
  oldPath: string | null;
  change: ShelvedChange;
  binary: boolean;
  oldId: string | null;
}

/** One shelved change list, stored in .git/gitmanager-shelf/<id>.json next to <id>.patch. */
export interface ShelfEntry {
  version: number;
  id: string;
  name: string;
  /** Milliseconds since the epoch. */
  createdAt: number;
  branch: string | null;
  headCommit: string | null;
  files: ShelvedFile[];
}

export interface ShelfFileDiff {
  diff: FileDiff;
  file: ShelvedFile;
  /** The original is gone: only the changed lines and their context show. */
  partial: boolean;
}

// Add to .gitignore

/** The root .gitignore (shared), or .git/info/exclude (this clone only). */
export type IgnoreTarget = "gitignore" | "exclude";

export interface IgnoreOutcome {
  /** Absolute path of the file written. */
  ignoreFile: string;
  added: string[];
  existing: string[];
  /** Tracked files the patterns match: they stay tracked until removed with git rm --cached. */
  trackedPaths: string[];
}

// Merge, Rebase and Commit options; the Branches popup

/** The Merge dialog's options; `message` is the merge commit's (-m). */
export interface MergeOptions {
  noFf: boolean;
  ffOnly: boolean;
  squash: boolean;
  noCommit: boolean;
  message: string | null;
  noVerify: boolean;
}

/** The Rebase dialog's options (not interactive). */
export interface RebaseOptions {
  /** The upstream of `git rebase <upstream>`, or the new base with --onto. */
  onto: string | null;
  /** With --onto: only the commits after it move. */
  upstream: string | null;
  /** The branch to rebase; null is the current one. */
  branchName: string | null;
  useOnto: boolean;
  rebaseMerges: boolean;
  keepEmpty: boolean;
  root: boolean;
  updateRefs: boolean;
}

/** -S, --no-gpg-sign, or neither (commit.gpgSign decides). */
export type GpgSign = "default" | "sign" | "noSign";

export interface CommitOptions {
  signOff: boolean;
  /** "Name <email>"; null keeps the configured author. */
  author: string | null;
  gpgSign: GpgSign;
  noVerify: boolean;
}

/** Compare with Current: commits only one side has, and the files that differ (base left, branch right). */
export interface BranchComparison {
  branchId: string;
  baseId: string;
  /** Newest first. */
  branchOnly: CommitSummary[];
  baseOnly: CommitSummary[];
  files: ChangedFile[];
  truncated: boolean;
}

/** Show Diff with Working Tree: files that differ between a revision and the work tree. */
export interface WorktreeComparison {
  commitId: string;
  files: ChangedFile[];
}

// MCP server and command line tool (src-tauri/src/mcp)

export type McpToolCategory = "Workspace" | "Git" | "Files" | "Search" | "Scripts" | "Terminal" | "App" | "Performance";

/** Who made a call: an AI harness over MCP, or `git-manager cli`. */
export type McpClient = "mcp" | "cli";

export interface McpStatus {
  enabled: boolean;
  cliEnabled: boolean;
  running: boolean;
  port: number;
  /** http://127.0.0.1:<port>/mcp */
  url: string;
  /** Only returned so Settings can show and copy it. */
  token: string | null;
  error: string | null;
  /** The app binary's absolute path plus " cli", for display. */
  cliCommand: string;
  /** Where `git-manager` is linked, or null when it is not installed. */
  cliInstalledPath: string | null;
  /** The install folder (~/.local/bin) is on PATH. */
  cliOnPath: boolean;
}

export interface McpToolInfo {
  name: string;
  title: string;
  description: string;
  category: McpToolCategory;
  kind: "backend" | "ui";
  readOnly: boolean;
  destructive: boolean;
  /** Effective state: the user's choice, else on unless destructive. */
  enabled: boolean;
  inputSchema: Record<string, unknown>;
}

/** A tool the frontend implements; sent once with mcp_register_ui_tools. */
export interface McpUiToolDef {
  name: string;
  title: string;
  description: string;
  category: McpToolCategory;
  readOnly: boolean;
  destructive: boolean;
  inputSchema: Record<string, unknown>;
}

export interface McpUiResult {
  ok: boolean;
  text: string;
  structured: Record<string, unknown> | null;
  imagePngBase64: string | null;
}

/** Payload of the "mcp-ui-request" event: answer it with mcp_ui_respond. */
export interface McpUiRequest {
  requestId: number;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface McpActivity {
  tool: string;
  /** Milliseconds since the epoch. */
  at: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
  client: McpClient;
}

/** The debug memory log (src-tauri/src/memory_log.rs). */
export interface MemoryLogStatus {
  enabled: boolean;
  /** Absolute path of memory.log. */
  path: string;
  intervalMs: number;
  thresholdMb: number;
}
