# Diffs

A diff shows two versions of a file side by side, with the differences highlighted. Use it to check your work before you commit, and to stage only some of the changes in a file.

![Side-by-side diff](../images/diff-view.png)

*A side-by-side diff of cart.ts: the toolbar, the Index and Working Tree labels, folded unchanged lines and the per-change stage buttons.*

## Open a diff

1. Open [Changes](Changes-and-Commits.md) (Shift+Cmd+G).
2. Click a file.

The diff opens in the **Diff** tab in the editor area. Use the Up and Down arrow keys in the Changes list to step through files; the diff follows. The right end of the toolbar shows the file name and its folder (with the repository in front when there are several).

The diff updates by itself when the file changes, and keeps its scroll position. With no file selected, the area says **Select a file in Changes to see its diff** (with a **Show Changes** button when the sidebar is hidden), or **Resolve conflicts to continue** while any file has a conflict.

Which two versions you see depends on the group you clicked:

- A file under **Changes**: the left side is the **Index** (what is staged, or the last commit when nothing is staged) and the right side is the **Working Tree** (the file on disk now).
- A file under **Staged**: the left side is **HEAD** (the last commit) and the right side is **Index (staged)**.

Commits in the [Log](History-and-Log.md) use the same view, read-only, comparing the commit with its parent.

## Reading the diff

- New lines are green on the right, changed lines are blue on both sides, and lines that were only removed are grey on the left.
- Inside a changed line, the exact words that changed are highlighted.
- The strip next to the scrollbar has a tick for every change. Click a tick to jump there.

## Move between changes

The toolbar above the diff has:

- **Up** and **Down** arrows for the previous and next change. F7 and Shift+F7 do the same while the diff has focus. After the last change they wrap to the first.
- A counter such as **1 of 2**, or **2 changes** when none is picked, or **No changes**.

When you open a diff it jumps to the first change.

## Collapse unchanged lines

**Collapse unchanged** (on by default) folds long runs of lines that are the same on both sides, keeping three lines of context around each change. A folded run shows as a bar such as **23 unchanged lines**. Click it to expand it, or turn the button off to see the whole file. Git Manager remembers your choice for every diff.

## Stage or unstage one change

You do not have to stage a whole file. Each change (a "hunk", one block of changed lines) has its own button in the gap between the two sides.

![Staging one change](../images/diff-hunk-staging.png)

*The diff toolbar at 1 of 2, and the first change with its « button between the sides.*

- In a diff from **Changes**, the button is **«** with the tooltip **Stage this change**. It copies that one change into the index.
- In a diff from **Staged**, the button is **»**, **Unstage this change**. It takes that one change out of the index again.

Example: in `src/cart.ts` you fixed a bug and also added a debug log. Stage only the fix, commit it, and keep the log for later.

After each click the lists in Changes update, so the file may appear in both Staged and Changes until every part is staged.

## Blame in a diff

The **Blame** button in the diff toolbar shows who last changed each line on the right side, and when. See [Blame](Blame.md). It uses the same setting as the Blame button in the editor.

## Special cases

- **No content changes**: the file changed in a way that is not text, for example only its permissions.
- **Binary file, no text diff**: images and other binary files are not compared.
- **File too large to diff**: very large files are skipped to keep the app fast.

Diffs and the merge tool never wrap long lines, so both sides stay aligned. Scroll sideways for long lines.

## Related

- [Changes and Commits](Changes-and-Commits.md)
- [Editor and Tabs](Editor-and-Tabs.md)
- [History and Log](History-and-Log.md)
- [Blame](Blame.md)
- [How diffs work (developer)](../developer/How-Diffs-Work.md)
