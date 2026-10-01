# Files Panel

The Files panel on the right is a tree of every file in your workspace. Use it to open files, and to see at a glance which ones git thinks are new, changed or in conflict.

![Files panel with status letters](../images/files-panel.png)

*Status letters and colors in the Files panel: M, A, U and D.*

## Show or hide it

- Click the tree icon in the thin bar on the right edge of the window.
- Or press Option+Cmd+B.
- Or click the x at the top of the panel.

Settings, Layout also has a **Files panel** switch. Drag the panel's left edge to make it wider, and double-click that edge to reset its width.

## What the tree shows

Folders come first, then files, both sorted by name. Folders load only when you open them, so even very large projects stay quick. A folder with more than 5000 entries shows the first 5000 in this order and a **5000+** note.

With one workspace folder, its contents are the top level. With several folders, each folder is a top-level row (see [Workspaces](Workspaces.md)). An empty folder says **This folder is empty.**

Repository folders get a git folder icon and show their current branch next to the name. The `.git` folder itself is never listed.

## Status letters and colors

Each changed file has a letter on the right and a matching color, like in VS Code: blue for changed, green for new, red for deleted or conflicted. Hover the letter to read the full state, for example "Modified (staged), modified (not staged)".

| Letter | Meaning |
| --- | --- |
| M | Modified: the file changed since the last commit. |
| A | Added: a new file that is staged (put into the next commit). |
| U | Untracked: a new file git is not tracking yet. |
| D | Deleted: the file is gone from disk but git still knows it. |
| R | Renamed. |
| T | Type changed, for example a file became a link. |
| C | Conflicted: a merge left this file with conflicts to fix. |

More details:

- The letter follows what the file looks like on disk now. A staged file that you changed again still shows its staged letter unless it was deleted or is untracked.
- A folder gets a small colored dot, and its name the same color, when something inside it changed. It takes the strongest color inside, so a conflict anywhere below turns it red.
- Deleted files stay in the tree, struck through, so you can still see what went away. Clicking one only reminds you that you can restore or stage the deletion from [Changes](Changes-and-Commits.md).
- Files that your `.gitignore` ignores are shown dimmed.

The tree refreshes on its own when files change on disk or in git, so you rarely need the Refresh button.

## Open files

- **Click** a file to open it in a preview tab. A preview tab (its name is in italics) is reused by the next file you click, so browsing does not pile up tabs.
- **Double-click** a file to open it in a tab that stays open.
- **Click** a folder to expand or collapse it.

The file shown in the editor is highlighted in the tree, so you always know where you are. See [Editor and Tabs](Editor-and-Tabs.md) for editing and saving.

## Keyboard

Click in the tree first, then:

- Up and Down arrows move the selection.
- Right arrow opens a folder. Left arrow closes it, or jumps to the parent folder.
- Enter opens the selected file or toggles the selected folder.

## Right-click menu

![Files panel context menu](../images/files-context-menu.png)

*Right-click a file or folder for more actions.*

On a file:

- **Open** opens it in a tab that stays open.
- **Open Preview** opens it in the preview tab.
- **Resolve Conflict...** appears for a conflicted file and opens the [Merge Tool](Merge-Tool.md).

On a folder:

- **Expand** or **Collapse**.
- **Set as Active Repository** on a repository folder (it reads **Active Repository** when it already is).
- **Initialize Repository Here** on a plain folder that is not inside any repository.
- **Add Folder to Workspace...** and **Remove Folder from Workspace** on a top-level workspace folder.

On everything:

- **Copy Path** copies the full path.
- **Copy Relative Path** copies the path inside the workspace folder.

A deleted file offers **Show in Changes** in place of Open. Copy Relative Path is greyed out on a workspace folder itself.

## The panel's buttons

At the top of the panel, next to the workspace name (hover it to see the full folder paths):

- **+** adds a folder to the workspace.
- The up chevron collapses every folder.
- The circular arrow refreshes the open folders.
- **x** hides the panel.

## Related

- [Workspaces](Workspaces.md)
- [Editor and Tabs](Editor-and-Tabs.md)
- [Changes and Commits](Changes-and-Commits.md)
- [How the Files panel works (developer)](../developer/How-the-Files-Panel-Works.md)
