# How Folder Watching Works

Git Manager notices changes on its own: an edit in another editor, a commit in the terminal, a new repository after `git clone`. One file watcher per workspace folder sorts every file event into "this repository changed" or "the folder changed". The rest of the workspace is in [How workspaces work](How-Workspaces-Work.md).

## Why we need it

- **No refresh button hunting.** Changes, the Files panel, the Log and the branch names should follow what happens on disk, like VS Code.
- **No polling.** Asking git for every status every few seconds costs CPU and memory in big workspaces. The operating system's file events are free until something changes.
- **Only the right repository refreshes.** In a folder with fifty repositories, an edit in one must not reread the other forty-nine.

## How it works

`watcher::watch` puts one debounced (300 ms) recursive watcher on a folder, plus the `.git` of an enclosing repository outside it and the git folders that linked worktrees and absorbed submodules point to. Each batch goes through the pure function `attribute`:

```mermaid
flowchart TD
  E["File event path"] --> G{"A .git entry created,<br/>removed or renamed?"}
  G -->|yes| WR["workspace-changed<br/>with reposChanged"]
  G -->|no| R{"Inside a known repo?<br/>(deepest wins)"}
  R -->|"no, and not inside a .git"| W["workspace-changed"]
  R -->|"no, a new HEAD in an unknown .git"| WR
  R -->|yes| D{"Inside that repo's .git?"}
  D -->|yes| N{"objects, logs, lfs or *.lock?"}
  N -->|yes| X["Dropped"]
  N -->|no| RG["repo-changed, gitDir"]
  D -->|no| I{"Ignored by .gitignore<br/>and not tracked?"}
  I -->|"yes, open in a tab"| OF["open-files-changed"]
  I -->|"yes, not open"| X
  I -->|no| RW["repo-changed, workTree<br/>plus workspace-changed"]
```

Other paths inside an unknown `.git` are dropped. Removing or moving a folder that holds a known repository, or moving in a folder with a `.git` (`has_git_entry`), also sets `reposChanged`. A changed submodule also refreshes its parent repository (`with_submodule_parents`), since the parent's status shows it. Batches that add, remove or rename files mark the Go to File index stale, and edits to source files mark the symbol index, so search stays current (see [How Search Everywhere works](How-Search-Everywhere-Works.md)).

A path counts as ignored only when a `.gitignore` rule matches it and it is not tracked (`IgnoreCheck`): git still follows a tracked file that a rule matches, so its status and diffs must too. The index is read once per batch, and only when a path matched a rule.

### Open files git ignores

An ignored file has no status, so nothing told its tab that it changed: an open log file showed only what it had when it opened. The page sends the files open in any tab (preview tabs too) with `watch_open_files`, whenever that list changes. `OpenFiles` (`open_files.rs`) keeps them per window, by real path. An ignored path that is open is not dropped: the batch reports it, and the watcher sends `open-files-changed` with the paths as the page named them. The store bumps `openFileVersions[filePath]`, and `FileView` reloads that tab like any other change from outside.

A reload replaces only the part that changed (`editor/reloadChange.ts`), so the caret and scroll stay. When the view is scrolled to the end and the text grew there, it scrolls to the new end, so a growing log is followed.

In the store, `repo-changed` calls `refreshRepo`. `workspace-changed` reloads the Files panel, and with `reposChanged` the store runs a quiet `rescan` one second later (`RESCAN_DELAY_MS`). That changes nothing unless the list of repositories changed; then it rewatches, refreshes and shows "Found repository NAME" (or "Found N new repositories"). Scan for Repositories (`rediscover`) still works too.

### Starting and stopping

`watch_workspace` and `unwatch_workspace` are `async` commands. They build and drop watchers through `commands::blocking`, because a Tauri command without `async` runs on the main thread, and dropping a watcher waits for its threads. Watchers live in `AppState.watchers`, keyed by folder root.

The watcher type is `Debouncer<RecommendedWatcher, NoCache>` (`state.rs`). The default file id cache walks every file under the folder when watching starts and keeps all their paths in memory. It is only needed to pair renames, and the watcher only asks which repository changed.

## Where the code lives

| File | What it does |
| --- | --- |
| `src-tauri/src/watcher.rs` | `watch`, `attribute`, `IgnoreCheck`, `has_git_entry`, linked git folders, submodule parents |
| `src-tauri/src/open_files.rs` | `OpenFiles`: the files open in each window's tabs |
| `src-tauri/src/state.rs` | `RepoWatcher` (with `NoCache`) and the `watchers` map |
| `src-tauri/src/commands/workspace.rs` | `watch_workspace`, `unwatch_workspace`, `stop_watcher` |
| `src/lib/stores/repo.svelte.ts` | `watchAll`, `refreshRepo`, `scheduleRescan`, `rescan`, `openFilePaths`, `openFileVersions` |
| `src/lib/views/Workspace.svelte` | sends `openFilePaths` to `watch_open_files` when it changes |
| `src/lib/editor/reloadChange.ts` | the smallest edit from the text on screen to the text on disk |

## Design decisions

**Sort events in a pure function.** `attribute` takes paths and two small lookups, so every case is tested without a real watcher.

**Drop git's noise.** Objects, logs, LFS files and lock files change on every git command and never change what the UI shows.

**Rescan only on a hint.** A rescan of a big folder is costly, so it runs only when a `.git` appeared, vanished or moved, once the burst settles.

**No file id cache.** Pairing renames is not worth a walk of every file and a copy of every path in memory.

**Report only open ignored files.** Sending every ignored path would flood the page during a build or `npm install`. The open tabs are the only ignored files anyone looks at, and the list is a few paths.

## Bugs we fixed

The watching bugs and their fixes are in [Folder Watching Bugs We Fixed](Folder-Watching-Bugs-We-Fixed.md). The freeze when watching a big folder started is in [How workspaces work](How-Workspaces-Work.md#bugs-we-fixed).

## Tests

- `src-tauri/src/watcher.rs`: `attribute` cases (noise, ignored paths, ignored files open in a tab, an enclosing repository, `reposChanged` for new, removed and moved repositories), the search index hints, linked git folders, submodule parents, `IgnoreCheck` with a tracked ignored file, and `has_git_entry` on a real folder.
- `src-tauri/src/open_files.rs`: open files kept by real path per window, also a file that does not exist yet.
- `src/lib/editor/reloadChange.test.ts`: appended lines, a changed middle, emptied, truncated and repeated text.

Live watchers need a check by hand with `scripts/make-workspace-demo.sh`. See [Testing](Testing.md).

## Keeping this page in sync

- Update this page when `attribute`, the events or the watcher setup change.
- Events are listed in [Commands and Events](Commands-and-Events.md).
