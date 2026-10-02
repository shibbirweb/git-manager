# Commands: Branches and Remotes

Commands for branches, merging and rebasing, the network, remotes, clone, patches and tags. How to read the columns, the events and the channels are explained in [Commands and Events](Commands-and-Events.md). Most of these back the Git menu, see [How the Git Menu Works](How-the-Git-Menu-Works.md).

## Branches

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `get_refs` | `getRefs(repoPath)` | `Refs` | git2 | local and remote branches, tags and remotes |
| `checkout_branch` | `checkoutBranch(repoPath, branchName)` | `void` | CLI | `git switch` |
| `checkout_remote_branch` | `checkoutRemoteBranch(repoPath, remoteBranch, localName)` | `void` | CLI | switches to or creates a tracking branch |
| `create_branch` | `createBranch(repoPath, branchName, startPoint, checkout)` | `void` | CLI | `git switch -c` or `git branch` |
| `rename_branch` | `renameBranch(repoPath, branchName, newName)` | `void` | CLI | `git branch -m` |
| `delete_branch` | `deleteBranch(repoPath, branchName, force)` | `void` | CLI | `git branch -d`, or `-D` when forced |
| `merge_branch` | `mergeBranch(repoPath, branchName)` | `OpOutcome` | CLI | `git merge --no-edit` into the current branch |
| `rebase_onto` | `rebaseOnto(repoPath, branchName)` | `OpOutcome` | CLI | `git rebase` onto the branch |

## Branches popup

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `update_branch` | `updateBranch(repoPath, branchName)` | `OpOutcome` | CLI | fetches and fast-forwards a branch that is not checked out (`git fetch <remote> <upstream>:<branch>`) |
| `push_branch` | `pushBranch(repoPath, branchName)` | `OpOutcome` | CLI | pushes a local branch to its upstream, or publishes and tracks it |
| `set_branch_upstream` | `setBranchUpstream(repoPath, branchName, upstream)` | `void` | CLI | `git branch --set-upstream-to` |
| `unset_branch_upstream` | `unsetBranchUpstream(repoPath, branchName)` | `void` | CLI | `git branch --unset-upstream` |
| `compare_branches` | `compareBranches(repoPath, branchName, baseName)` | `BranchComparison` | git2 | commits only each side has, and the files that differ |
| `compare_with_worktree` | `compareWithWorktree(repoPath, revision)` | `WorktreeComparison` | git2 | files that differ between a revision and the work tree |

## Merge and Rebase dialogs

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `merge_with_options` | `mergeWithOptions(repoPath, branchName, options)` | `OpOutcome` | CLI | `git merge` with `MergeOptions` (no fast-forward, fast-forward only, squash, no commit, message, no verify) |
| `rebase_with_options` | `rebaseWithOptions(repoPath, options)` | `OpOutcome` | CLI | `git rebase` with `RebaseOptions` (onto, upstream, branch, rebase merges, keep empty, root, update refs) |
| `rebase_plan` | `rebasePlan(repoPath, fromCommit)` | `RebasePlan` | git2 | the commits an interactive rebase from a commit (included) to HEAD rewrites |
| `rebase_plan_onto` | `rebasePlanOnto(repoPath, upstream)` | `RebasePlan` | git2 | the commits of `upstream..HEAD`, for the Rebase dialog's interactive option |
| `interactive_rebase` | `interactiveRebase(repoPath, base, entries, autostash)` | `OpOutcome` | CLI | `git rebase -i` with the dialog's todo, oldest first; `base` null rebases from the root |

See [How Interactive Rebase Works](How-Interactive-Rebase-Works.md) for the todo, including merge commits.

## Fetch, pull and push

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `fetch_all` | `fetchAll(repoPath)` | `OpOutcome` | CLI | `git fetch --all --prune` (Fetch All Remotes) |
| `fetch` | `fetch(repoPath, prune)` | `OpOutcome` | CLI | `git fetch` with no remote named (the branch's remote), optionally pruning |
| `pull` | `pull(repoPath, rebase)` | `OpOutcome` | CLI | `git pull`, `--rebase` when asked |
| `push` | `push(repoPath, force)` | `OpOutcome` | CLI | `git push`, `--force-with-lease` when forced, sets the upstream on first push |
| `push_tags` | `pushTags(repoPath)` | `OpOutcome` | CLI | pushes every local tag to the branch's remote |
| `pull_with_options` | `pullWithOptions(repoPath, remoteName, branchName, mode, noCommit)` | `OpOutcome` | CLI | the Pull dialog: `mode` is `merge`, `rebase` or `ffOnly`; null names pull the upstream |
| `push_with_options` | `pushWithOptions(repoPath, remoteName, remoteBranch, forceWithLease, pushTags)` | `OpOutcome` | CLI | the Push dialog: pushes the current branch, tracking it when it has no upstream |
| `outgoing_commits` | `outgoingCommits(repoPath, remoteName, remoteBranch)` | `OutgoingCommits` | git2 | the commits a push would send, listed in the Push dialog |

All of them except `outgoing_commits` send `git-progress` events while they run, and so do `update_branch` and `push_branch`.

## Remotes and clone

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `list_remotes` | `listRemotes(repoPath)` | `RemoteInfo[]` | git2 | every remote with its fetch and push URLs |
| `add_remote` | `addRemote(repoPath, remoteName, fetchUrl, pushUrl)` | `void` | CLI | `git remote add`, plus a push URL when given |
| `edit_remote` | `editRemote(repoPath, remoteName, newName, fetchUrl, pushUrl)` | `void` | CLI | renames when `newName` differs, then sets the URLs |
| `remove_remote` | `removeRemote(repoPath, remoteName)` | `void` | CLI | `git remote remove` |
| `clone_repository` | `cloneRepository(url, parentDir, folderName, progress, cancelId)` | `string` | CLI | `git clone --progress` into an empty or new folder; returns its path |
| `cancel_git_command` | `cancelGitCommand(cancelId)` | `boolean` | app | stops the command started with `cancelId`; the clone fails with "Clone cancelled" |

`cancel_git_command` uses `git/cancel.rs`: the command runs in its own process group, so git's helpers stop with it.

## Patches

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `create_patch` | `createPatch(repoPath, source, filePaths, patchPath)` | `number` | CLI | writes `git diff --binary` of `staged`, `unstaged` or `all` changes; returns the file count |
| `create_commit_patch` | `createCommitPatch(repoPath, commitId, patchPath)` | `void` | CLI | `git format-patch -1 --stdout` of a commit |
| `apply_patch` | `applyPatch(repoPath, patchPath, patchText)` | `OpOutcome` | CLI | checks, then applies a file or text; falls back to `git apply --3way` |
| `read_clipboard_text` | `readClipboardText()` | `string` | app | the clipboard's text, read natively (`pbpaste` on macOS), for Apply Patch from Clipboard |

## Tags

The tag list comes with `get_refs`.

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `create_tag` | `createTag(repoPath, tagName, message, commitId)` | `void` | CLI | annotated when `message` has text, lightweight otherwise; at HEAD unless `commitId` is given |
| `delete_tag` | `deleteTag(repoPath, tagName)` | `void` | CLI | deletes a local tag; the remote keeps it |
