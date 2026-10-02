# Commands: History and Extras

Commands for the log, blame, file history, reset, worktrees, submodules, Git LFS and the GitHub account. How to read the columns, the events and the channels are explained in [Commands and Events](Commands-and-Events.md).

## History and blame

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `get_log` | `getLog(repoPath, offset, limit, allRefs)` | `CommitSummary[]` | git2 | one page of history (at most 1000) |
| `get_commit_details` | `getCommitDetails(repoPath, commitId)` | `CommitDetails` | git2 | message, parents and changed files |
| `blame_file` | `blameFile(repoPath, filePath, revision, contents)` | `BlameInfo` | CLI | `git blame --porcelain` (of `contents` when set), with `originalLines` |
| `file_history` | `fileHistory(repoPath, filePath, offset, limit)` | `FileHistoryEntry[]` | CLI | `git log --follow` of one file, newest first, with its path in each commit |
| `line_history` | `lineHistory(repoPath, filePath, startLine, endLine, limit)` | `LineHistoryEntry[]` | CLI | `git log -L start,end:file` (1-based, inclusive, lines of the HEAD version) |
| `resolve_revision` | `resolveRevision(repoPath, revision)` | `string` | git2 | the full commit id a branch, tag, hash or HEAD points at |
| `cherry_pick` | `cherryPick(repoPath, commitId)` | `OpOutcome` | CLI | `git cherry-pick` |
| `revert_commit` | `revertCommit(repoPath, commitId)` | `OpOutcome` | CLI | `git revert --no-edit` |
| `reset_to` | `resetTo(repoPath, commitId, mode)` | `void` | CLI | `git reset` with `soft`, `mixed`, `hard` or `keep` (Reset HEAD dialog and the Log) |
| `checkout_commit` | `checkoutCommit(repoPath, commitId)` | `void` | CLI | `git switch --detach` |

File and line history use the CLI because libgit2 can neither follow renames nor trace a range of lines (`git/history.rs`).

## Worktrees

A worktree is a second work folder of the same repository. See [How Worktrees Work](How-Worktrees-Work.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `list_worktrees` | `listWorktrees(repoPath)` | `WorktreeInfo[]` | CLI | `git worktree list --porcelain`, marking the current one |
| `add_worktree` | `addWorktree(repoPath, worktreePath, branch)` | `string` | CLI | `git worktree add` for an existing, new or detached `WorktreeBranch`; returns its path |
| `remove_worktree` | `removeWorktree(repoPath, worktreePath, force)` | `void` | CLI | `git worktree remove`, `--force` when asked |
| `lock_worktree` | `lockWorktree(repoPath, worktreePath, reason)` | `void` | CLI | `git worktree lock`, with an optional reason |
| `unlock_worktree` | `unlockWorktree(repoPath, worktreePath)` | `void` | CLI | `git worktree unlock` |
| `prune_worktrees` | `pruneWorktrees(repoPath)` | `string` | CLI | `git worktree prune --verbose`; returns git's report |
| `worktree_has_changes` | `worktreeHasChanges(worktreePath)` | `boolean` | git2 | whether removing it would throw away changes (it then needs force) |

## Submodules

Paths are relative to the parent repository. See [How Submodules Work](How-Submodules-Work.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `list_submodules` | `listSubmodules(repoPath)` | `SubmoduleInfo[]` | git2 | every submodule from `.gitmodules`, the index and HEAD |
| `init_submodules` | `initSubmodules(repoPath, submodulePaths)` | `string` | CLI | `git submodule init`; every submodule when the list is empty |
| `update_submodules` | `updateSubmodules(repoPath, remote, submodulePaths)` | `string` | CLI | `git submodule update --init --recursive`, `--remote` when asked, with `git-progress` |
| `sync_submodules` | `syncSubmodules(repoPath)` | `string` | CLI | `git submodule sync --recursive` |
| `add_submodule` | `addSubmodule(repoPath, url, submodulePath, branchName)` | `string` | CLI | `git submodule add`, with a branch when given |
| `remove_submodule` | `removeSubmodule(repoPath, submodulePath)` | `void` | CLI | deinit, `git rm` and its clone under `.git/modules` |

## Git LFS

Git LFS (Large File Storage) keeps big files outside the repository. See [How Git LFS Works](How-Git-LFS-Works.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `lfs_status` | `lfsStatus(repoPath)` | `LfsStatus` | CLI | whether git-lfs is installed and used, its patterns and files |
| `lfs_track` | `lfsTrack(repoPath, pattern)` | `string` | CLI | `git lfs track <pattern>` |
| `lfs_untrack` | `lfsUntrack(repoPath, pattern)` | `string` | CLI | `git lfs untrack <pattern>` |
| `lfs_transfer` | `lfsTransfer(repoPath, pull)` | `string` | CLI | `git lfs pull` (`pull` true) or `git lfs fetch`, with `git-progress` |
| `lfs_prune` | `lfsPrune(repoPath)` | `string` | CLI | `git lfs prune` |
| `lfs_install` | `lfsInstall(repoPath)` | `string` | CLI | `git lfs install --local` (the hooks of this repository) |

## GitHub account

The token goes in once and never comes back to the UI. See [How GitHub Works](How-GitHub-Works.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `github_account` | `githubAccount()` | `GitHubAccount \| null` | file | the signed-in account from `~/.gitmanager/github.json`; no network, no keychain |
| `github_cli_status` | `githubCliStatus()` | `GhCliStatus` | app | whether the `gh` CLI is installed and signed in |
| `github_sign_in_with_token` | `githubSignInWithToken(token)` | `GitHubAccount` | net | verifies the token with `GET /user`, then keeps it only in the system keychain |
| `github_sign_in_with_cli` | `githubSignInWithCli()` | `GitHubAccount` | net | uses `gh auth token` on demand; stores only the login |
| `github_sign_out` | `githubSignOut()` | `void` | file | removes the keychain entry and `github.json` |
| `github_share_project` | `githubShareProject(repoPath, request)` | `GitHubSharedRepository` | net | creates the repository on GitHub and adds it as a remote, committing first when asked; push comes next |
| `github_repository` | `githubRepository(owner, repo)` | `GitHubRepositoryInfo` | net | the repository's details, such as whether it is a fork |
| `github_sync_fork` | `githubSyncFork(owner, repo, branchName)` | `GitHubSyncForkOutcome` | net | GitHub's merge-upstream for one branch of a fork |
| `github_create_gist` | `githubCreateGist(request)` | `GitHubGist` | net | creates a gist |
