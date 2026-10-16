# How the staging view works

The staging view shows a file of the Changes diff in three panes: HEAD, the index and the work tree, with bands joining each side's changes to the index in the middle. It reuses the 3-pane diff of merge commits. For the user side, see [Staging View](../usage/Staging-View.md).

## Why we need it

The two-pane diff shows either the staged or the unstaged half of a file, so a file with both needs two clicks to understand. PhpStorm shows both halves at once around the index, and stages or unstages from the bands. We already had every piece: the 3-pane frame and bands of the merge tool and the merge commit view.

## How it works

`ChangesDiff.svelte` (and the status bar's Changes tab, `ChangesTab.svelte`) shows `ThreePaneDiff.svelte` when Diff layout is side by side, `settings.changesDiffPanes` is `"three"` and `stagingViewFits` says the file is a plain modified file (not new, deleted, renamed, untracked or conflicted). `StagingDiffs` (`views/changes/stagingDiffs.svelte.ts`) loads both diffs:

```mermaid
flowchart LR
    S[get_file_diff staged] --> L[HEAD against the index: left]
    U[get_file_diff unstaged] --> W[workTreeSide: flip it]
    W --> R[work tree against the index: right]
    L --> T[ThreePaneDiff]
    R --> T
```

`ThreeWayEditors` takes each side pane against the middle. The unstaged diff runs the other way (index to work tree), so `workTreeSide` swaps its texts, EOLs and hunks (`flipHunks`). The options `{ rightNewer: true, conflicts: false }` keep its colors right (lines the work tree adds are green) and never call a change a conflict.

A band's arrow calls `ThreeWayEditors.taken(side, index)`, which `takeChange` builds: the index text with the change's lines from that side. `changesSelection.applyDiffChange` writes it to the index, the same path as the two-pane arrows. The new status reloads both diffs; `StagingDiffs` keeps a diff whose texts did not change, and `ThreePaneDiff` keeps the middle pane's scroll position when it rebuilds.

The layout buttons come from `DiffToolbar`'s `onthreepanes` (two panes to three) and `ThreePaneDiff`'s `onlayout` (back to two). **Open File** shows when the caller passes `workingFile`; it calls `openWorkingFile` (`diff/openWorkingFile.ts`, shared with `DiffView`) at `ThreeWayEditors.lineOnScreen("right")`, the working tree's line.

## Where the code lives

| File | What it does |
| --- | --- |
| `src/lib/views/changes/stagingDiffs.svelte.ts` | Which files fit, loading both diffs, the flipped work tree side |
| `src/lib/views/changes/ChangesDiff.svelte`, `views/git/ChangesTab.svelte` | Pick the staging view or the two-pane diff |
| `src/lib/diff/ThreePaneDiff.svelte` | The toolbar and the frame, for merges and staging |
| `src/lib/diff/threeWay.ts` | `ThreeWayOptions`, `flipHunks`, `takeChange` |

## Design decisions

- **Off by default.** The two-pane diff stays the Changes default; the choice is remembered once made.
- **A setting, not browser storage.** The pane counts are preferences in `settings.json` (`changesDiffPanes`, `mergeDiffPanes`), so Settings > Git can show them and they move with the settings file. Three columns show only while Diff layout is side by side; the toolbar's Side by side button means 2 columns (`diff/diffPanes.ts`). The old `localStorage` flags are not read back, so a changed choice starts at the default once.
- **Plain modified files only.** A new or deleted file has an empty side, and a rename has two paths; the two-pane diff shows them better.

## Tests

- `src/lib/views/changes/stagingDiffs.test.ts`: which files fit, the flipped work tree side and the index's line ending (`indexEol`).
- `src/lib/diff/threeWay.test.ts`: the staging colors, no conflicts, and staging and unstaging with `takeChange`.

## Bugs we fixed

**The three panes had no Open File button.**
- **The issue:** the two-pane diff has **Open File**, but switching to three panes (staging or a merge commit) lost it.
- **Why it happened:** `ThreePaneDiff` builds its own toolbar, and Open File lived only in `DiffView`.
- **The fix and why we chose it:** the open code moved to `openWorkingFile.ts`, which both views call, so the check for a missing file and the toast stay the same in both.

**The Changes tab had no Three panes button.**
- **The issue:** the diff in the Changes tab (status bar > **N changes**) showed only Side by side and Inline, so a modified file could not open in the staging view there.
- **Why it happened:** only `ChangesDiff.svelte` passed `onThreePanes` and drew `ThreePaneDiff`; the tab compares with HEAD in its own view.
- **The fix and why we chose it:** the tab uses the same `stagingViewFits`, `StagingDiffs` and `changesDiffPanes` setting, so both places look and switch alike. Its Stage and Unstage write the index pane's text with `stageContent`, in the index's own line ending (`indexEol`), one click after another.

## Keeping this page in sync

- Retake `diff-staging-view.png` when the view looks different.
