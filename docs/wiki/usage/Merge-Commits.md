# Merge Commits

A merge commit joins two branches, so it has two parents: the branch you merged into (parent 1) and the branch you merged (parent 2). The [Log](History-and-Log.md) shows a merge the way JetBrains IDEs do, so you can see which files the merge had to put together.

[TODO:merge-commit-files.png]

*A merge commit with no files changed on both sides, and the link to see its changes to each parent.*

## Changed on both sides

Select a merge in the Log. Under its details, **Changed on both sides** lists only the files that differ from every parent. These are the files the merge combined: both branches changed them, so git merged their lines, or there was a conflict and someone resolved it by hand. A merge with a conflict usually says so in its message too, under `# Conflicts:`.

Files that came whole from one branch are not listed, since the merge did nothing to them. If no file changed on both sides, the list says **No files changed on both sides** and offers **Show changes to parents**.

Click a file to see its diff against **Parent 1**: what the other branch and the resolution brought in.

## Changes to parents

Click **Show parents** at the top right of the list (or **Show changes to parents** when the list is empty) to see everything the merge changed, in one group per parent:

- **Changes to parent 1**: what the merge brought into your branch. This is what most tools show for a merge.
- **Changes to parent 2**: what the merge changed compared with the merged branch.

A file can be in both groups. Its diff is labelled **Parent 1** or **Parent 2**, so you always know which side you compare with. Click **Show both sides** to go back. The Log keeps your choice while you move between commits.

## Why a file might be listed without a conflict

Git does not record conflicts in the history. When both branches change the same file in different places, git merges it on its own, and the file still differs from both parents. So the list shows every file the merge combined, a superset of the files that had a conflict. This is the same list as `git diff-tree -c --name-only <merge>`, and as PhpStorm's view of a merge.

## Related

- [History and Log](History-and-Log.md)
- [Resolving conflicts](Resolving-Conflicts.md)
- [How merge commits work](../developer/How-Merge-Commits-Work.md)
