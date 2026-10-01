# Testing

Git Manager changes people's repositories, so its tests use real git, not mocks. This page explains the two test suites, the helpers behind them, and what you must run before a change counts as done.

```mermaid
flowchart TB
  subgraph Rust["cargo test (src-tauri)"]
    Unit["unit tests next to the code<br/>watcher, config, state, engine,<br/>blame, files, stash, workspace files"]
    Git["git/tests.rs<br/>readers and the CLI runner"]
    Cmd["commands/tests.rs<br/>whole commands"]
    Oracle["merge engine vs git merge-file"]
    Script["make-conflict-repo.sh output"]
  end
  subgraph Vitest["bun run test"]
    Pure["pure .ts modules in src/lib"]
    Tools["scripts/*.test.ts"]
  end
  Support["test_support.rs<br/>temporary repositories<br/>isolated git config"] --> Git
  Support --> Cmd
  Support --> Script
```

## Rust tests

Run them with `cd src-tauri && cargo test`. Add a filter to run a few, for example `cargo test watcher`.

### Real repositories, isolated from your config

`src-tauri/src/test_support.rs` builds repositories in temporary folders that vanish after the test. Before any test touches git, it points git at a sandbox:

- `HOME` and `XDG_CONFIG_HOME` move to a temporary folder;
- `GIT_CONFIG_GLOBAL` points at an empty file and `GIT_CONFIG_NOSYSTEM=1` skips the system config;
- `LC_ALL=C` and `LANG=C`, so git messages are always in English.

Why so strict? Your own `~/.gitconfig` might sign commits, rebase on pull, use a different conflict style or run hooks. Any of those would make a test pass on one machine and fail on another. Each repository also gets a local config: a test identity, signing off, an empty hooks folder, `merge.conflictstyle = merge` and `pull.rebase = false`. Commit dates come from a fixed clock, so hashes and the log order are stable.

The git processes come from `cli::command`, the same builder the app uses. The tests therefore exercise the real environment the app sets up.

### Helpers you will use

| Helper | What it gives you |
| --- | --- |
| `TestRepo::new()` | an empty repository on `main` with the local config above |
| `repo.write`, `repo.commit_all`, `repo.branch`, `repo.checkout` | build history in a few lines |
| `repo.git(&[...])`, `repo.porcelain()`, `repo.unmerged()` | run git and inspect the result |
| `merge_conflict_repo()` | a repository stopped in a merge with a both-modified file, both added, deleted by us and by them, a binary and a CRLF file |
| `diverged_repo()` | two branches that edit the same file |
| `BareRemote::new()`, `TestRepo::clone_from` | a local "remote" for fetch, pull and push tests |
| `TestDir` | a plain folder for workspace tests, with `init_repo` for nested repositories |
| `block_on` | runs an async Tauri command in a test |

`commands/tests.rs` calls the command functions directly, for example `block_on(merge::save_resolution(...))`, and then checks the repository with git itself. `git/tests.rs` covers the readers and the CLI runner. Smaller modules test themselves next to the code, for example `watcher.rs` (`attribute`, `has_git_entry`), `workspace_file.rs`, `git/blame.rs` (original line numbers), `git/files.rs` (the 5000 entry limit), `commands/stash.rs` (nothing to stash) and `commands/config.rs` (`os_info` parsing).

### The demo script is tested too

`git/tests.rs` runs `scripts/make-conflict-repo.sh` (with and without `--rebase`) and asserts the exact list of conflicts it creates, and that it refuses a folder that is not empty. The demo is what people use to try the merge tool, so it must not rot. If you change the script, update these tests.

### The merge engine and its oracle

`src-tauri/src/merge/engine.rs` has hand-written cases (one-sided changes, overlaps, touching changes, insertions, missing final newlines, ignore-whitespace) and a property test that uses git as an oracle. The test builds 300 random base, ours and theirs files, merges them with our engine and with `git merge-file -p`, and:

- when both say "clean", requires the merged text to be identical;
- requires more than 50 clean cases, so the test cannot pass by comparing nothing;
- allows fewer than 5% clean or conflict disagreements, because our diff heuristics differ slightly from git's.

It skips itself when git is not installed. The random generator is seeded, so a failure repeats every time.

## Vitest suites

Run them with `bun run test`, one file with `bun run test src/lib/stores/tabs.test.ts`, or `bun run test:watch` to rerun on every save. Vitest picks up `src/**/*.test.ts` and `scripts/**/*.test.ts` (see `vite.config.js`).

| Suite | Covers |
| --- | --- |
| `src/lib/merge/model.test.ts` | line replacement edge cases and chunk actions: apply, append, ignore, apply all non-conflicting |
| `src/lib/merge/inline.test.ts` | word-level change highlights |
| `src/lib/merge/extensions.test.ts` | the Cmd+Enter apply keymap outranks the default keymap |
| `src/lib/editor/lineDiff.test.ts` | the line diff behind change markers; it always rebuilds the new text |
| `src/lib/editor/conflictMarkers.test.ts` | finding conflict markers (also diff3) and resolving them |
| `src/lib/editor/blameModel.test.ts` | keeping blame owners and commit-side lines in step with edits |
| `src/lib/editor/navigation.test.ts` | next and previous change, with wrap-around |
| `src/lib/editor/wheelZoom.test.ts` | Ctrl + wheel font zoom, trackpad deltas and limits |
| `src/lib/editor/languageName.test.ts` | language names by file extension |
| `src/lib/log/graph.test.ts` | commit graph lanes, merges, octopus merges, paging |
| `src/lib/log/lineMatch.test.ts` | finding the blamed line in a commit's file |
| `src/lib/stores/tabs.test.ts` | preview tabs, pinning, closing order |
| `src/lib/stores/navHistory.test.ts` | Back and Forward across files, diffs and the Log, skipping stops that are gone |
| `src/lib/stores/workspacePaths.test.ts` | path joins, deepest repository, folder lookup |
| `src/lib/stores/fontFamily.test.ts` | cleaning user-typed font lists |
| `src/lib/stores/settingsData.test.ts` | settings validation, what may be saved, migration, session steps |
| `src/lib/update/releases.test.ts` | which releases each channel is offered, the safe Markdown renderer, issue links |
| `src/lib/update/update.test.ts` | changelog parsing and semver ordering |
| `src/lib/views/changes/sections.test.ts` | grouping the Changes sidebar per repository and keeping the selection |
| `src/lib/views/changes/drafts.test.ts` | commit message drafts per repository |
| `src/lib/views/changes/fileStatus.test.ts` | unique row ids for the Changes list |
| `src/lib/views/files/tones.test.ts` | git status colors and letters in the Files panel |
| `src/lib/views/workspaceShortcuts.test.ts` | which window shortcut a key means, skipping handled keys |
| `scripts/versioning.test.ts` | Cargo file rewrites, next versions, untried commits, changelog sections |
| `scripts/wiki.test.ts` | wiki link rewriting, word counts, style checks, manifest checks |

## What to test

- **Put non-trivial logic in a pure `.ts` module** next to its component and test it there. Components are hard to test; pure functions are easy. `merge/model.ts`, `editor/lineDiff.ts`, `stores/tabs.ts` and `stores/navHistory.ts` are good examples.
- **Every backend change gets a Rust test** with a real temporary repository.
- **Every bug fix gets a test** that fails without the fix, and a "Bugs we fixed" entry in the feature's chapter (see [Docs and Screenshots](Docs-and-Screenshots.md)).

## What "done" means

A change is done when all of these pass on your machine:

```sh
bun run check                                  # 0 errors and 0 warnings
bun run test
cd src-tauri && cargo test
cd src-tauri && cargo clippy --all-targets -- -D warnings
bun scripts/build-wiki.ts --check              # when docs changed
```

CI runs the same commands (with `--locked` for cargo), so this also keeps the pull request green. Some things no test sees, such as how a view looks or feels. When you could not check something, say so plainly in the pull request instead of calling it done.

## Lessons learned

**The oracle test compared too few cases.** The first version of the property test changed lines so often that almost every random case conflicted. Its guard (at least 20 clean cases) caught this: only 8 of 150 cases were clean, so the test failed instead of passing while comparing almost nothing. We made mutations rarer, doubled the cases to 300, raised the bar to 50 clean cases and added the disagreement limit. The lesson: a property test needs a check that it really tested something.
