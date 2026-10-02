# Commands: Workspace and Changes

Commands for opening folders, reading status, staging, committing, diffs, conflicts, stashes and the shelf. How to read the columns, the events and the channels are explained in [Commands and Events](Commands-and-Events.md).

## Repository and workspace

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `get_launch_mode` | `getLaunchMode()` | `LaunchMode` | app | app mode (optional folder) or mergetool mode |
| `open_repo` | `openRepo(repoPath)` | `RepoInfo` | git2 | finds the repository containing a path |
| `open_workspace` | `openWorkspace(folderPath)` | `WorkspaceInfo` | file | opens a folder and scans it for repositories |
| `discover_repositories` | `discoverRepositories(workspaceRoot)` | `RepoInfo[]` | file | rescans one folder (Scan for Repositories, `reposChanged`) |
| `init_repository` | `initRepository(folderPath)` | `RepoInfo` | CLI | `git init` in a plain folder |
| `watch_workspace` | `watchWorkspace(workspaceRoot, repoRoots)` | `void` | app | starts the file watcher for one folder, off the main thread |
| `unwatch_workspace` | `unwatchWorkspace(workspaceRoot)` | `void` | app | stops it, also off the main thread |
| `read_workspace_file` | `readWorkspaceFile(filePath)` | `WorkspaceFile` | file | reads a `.gitmanager-workspace` or `.code-workspace` file |
| `write_workspace_file` | `writeWorkspaceFile(filePath, folders)` | `void` | file | saves the folders atomically, keeping other keys, entries and comments |

## Status, staging and commits

`options` is `CommitOptions | null` (sign-off, author, GPG signing, skip hooks); null commits with the defaults.

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `get_status` | `getStatus(repoPath)` | `RepoStatus` | git2 | HEAD and upstream, the operation in progress, changed files and submodules |
| `get_head_message` | `getHeadMessage(repoPath)` | `string` | git2 | the last commit message, for amend |
| `stage_files` | `stageFiles(repoPath, filePaths)` | `void` | CLI | `git add -A` |
| `unstage_files` | `unstageFiles(repoPath, filePaths)` | `void` | CLI | `git restore --staged`, or `git rm --cached` before the first commit |
| `discard_files` | `discardFiles(repoPath, trackedPaths, untrackedPaths)` | `void` | CLI | `git restore --worktree`; deletes untracked files |
| `stage_content` | `stageContent(repoPath, filePath, content, eol)` | `void` | CLI | writes text into the index (hunk staging) |
| `write_worktree_file` | `writeWorktreeFile(repoPath, filePath, content, eol)` | `void` | file | overwrites a work tree file |
| `commit` | `commit(repoPath, message, amend, options)` | `GitOutput` | CLI | `git commit -F -`, optionally `--amend` |
| `commit_all` | `commitAll(repoPath, message, amend, options)` | `GitOutput` | CLI | `git commit --all`: every tracked change; untracked files stay out |
| `commit_files` | `commitFiles(repoPath, filePaths, message, amend, options)` | `GitOutput` | CLI | `git commit --only` these files; other staged changes stay staged |
| `undo_last_commit` | `undoLastCommit(repoPath)` | `string` | CLI | `git reset --soft HEAD~1`; returns the undone message |
| `rollback_files` | `rollbackFiles(repoPath, filePaths, deleteAdded)` | `void` | CLI | Rollback: tracked files back to HEAD; added files are unstaged, and deleted when asked |

## Diffs

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `get_file_diff` | `getFileDiff(repoPath, filePath, origPath, area)` | `FileDiff` | git2 | both sides of a staged or unstaged change |
| `get_commit_file_diff` | `getCommitFileDiff(repoPath, commitId, filePath, origPath)` | `FileDiff` | git2 | both sides of one file in a commit |
| `revisions_file_diff` | `revisionsFileDiff(repoPath, fromRevision, toRevision, filePath, origPath)` | `FileDiff` | git2 | one file between two revisions (branch compare tabs) |
| `compare_with_revision` | `compareWithRevision(repoPath, filePath, revision)` | `RevisionDiff` | git2 | the file at a revision against the work tree copy |

## Merge and conflicts

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `list_conflicts` | `listConflicts(repoPath)` | `ConflictSummary` | git2 | the operation in progress and every conflicted file |
| `load_conflict` | `loadConflict(repoPath, conflictPath, ignoreWhitespace)` | `MergeDocument` | git2 | base, ours, theirs and chunks |
| `save_resolution` | `saveResolution(repoPath, conflictPath, content, eol)` | `void` | CLI | writes the result, then `git add` |
| `accept_side` | `acceptSide(repoPath, conflictPaths, side)` | `void` | CLI | takes `ours` or `theirs` for whole files, or removes them |
| `continue_operation` | `continueOperation(repoPath)` | `OpOutcome` | CLI | `--continue` for the merge, rebase, cherry-pick or revert |
| `abort_operation` | `abortOperation(repoPath)` | `OpOutcome` | CLI | `--abort` for the same |
| `skip_rebase_commit` | `skipRebaseCommit(repoPath)` | `OpOutcome` | CLI | `git rebase --skip` |

## Mergetool

These only work when the app was started as `git mergetool`. See [How Mergetool Mode Works](How-Mergetool-Mode-Works.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `load_mergetool` | `loadMergetool(ignoreWhitespace)` | `MergeDocument` | file | reads BASE, LOCAL, REMOTE and MERGED |
| `save_mergetool` | `saveMergetool(content, eol)` | `void` | file | writes MERGED and exits with status 0 |
| `cancel_mergetool` | `cancelMergetool()` | `void` | app | exits with status 1 |

## Stash

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `get_stashes` | `getStashes(repoPath)` | `StashEntry[]` | git2 | the stash list |
| `stash_push` | `stashPush(repoPath, message, includeUntracked)` | `void` | CLI | `git stash push`; error "No local changes to stash" if nothing was stashed |
| `stash_apply` | `stashApply(repoPath, stashIndex, pop)` | `OpOutcome` | CLI | `git stash apply`, or `pop` |
| `stash_drop` | `stashDrop(repoPath, stashIndex)` | `void` | CLI | `git stash drop` |
| `stash_clear` | `stashClear(repoPath)` | `void` | CLI | `git stash clear`; the UI confirms first |

## Shelf

Shelved changes are patches in `<git dir>/gitmanager-shelf/`. See [How the Shelf Works](How-the-Shelf-Works.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `shelve_changes` | `shelveChanges(repoPath, name, filePaths, keepInWorkingTree)` | `ShelfEntry` | CLI | saves the files' changes as a patch, then reverts them unless kept |
| `list_shelf` | `listShelf(repoPath)` | `ShelfEntry[]` | file | every shelved change list |
| `unshelve` | `unshelve(repoPath, shelfId, filePaths, removeFromShelf)` | `OpOutcome` | CLI | `git apply` of all files (`filePaths` null) or some, 3-way when it does not fit |
| `shelf_file_diff` | `shelfFileDiff(repoPath, shelfId, filePath)` | `ShelfFileDiff` | file | both sides of one shelved file, for Show Diff |
| `rename_shelf` | `renameShelf(repoPath, shelfId, name)` | `ShelfEntry` | file | renames a change list |
| `delete_shelf` | `deleteShelf(repoPath, shelfId)` | `void` | file | deletes it for good; the UI confirms first |

## Ignore files

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `add_to_ignore` | `addToIgnore(repoPath, patterns, target, filePaths)` | `IgnoreOutcome` | file | appends new patterns to `.gitignore` or `.git/info/exclude`, reports tracked matches |
| `ensure_ignore_file` | `ensureIgnoreFile(repoPath, target)` | `string` | file | the ignore file's absolute path, created empty when missing (Edit .gitignore) |
| `untrack_files` | `untrackFiles(repoPath, filePaths)` | `void` | CLI | `git rm --cached`, so ignored files stop being tracked |
