# Editor and Tabs

Git Manager has a light code editor for quick fixes. Open files in tabs, edit and save them, and jump straight to the lines you changed since the last commit.

![Editor tabs, breadcrumbs and toolbar](../images/editor-tabs.png)

*Tabs with an italic preview tab, the breadcrumb path and the toolbar row.*

## Open a file

- Click a file in the [Files panel](Files-Panel.md) to open it in a **preview tab**. Its name is shown in italics, and the next file you click replaces it.
- Double-click a file to open it in a normal tab that stays open.

A preview tab becomes a normal tab when you double-click the tab, start editing, or choose **Keep Open** in its right-click menu.

Files larger than 4 MB and binary files (such as images) are not opened. The tab shows a short note with the file size instead. If a file is deleted on disk while its tab is open, the tab says **This file no longer exists on disk.** and offers **Close**.

## When nothing is open

![The empty editor area](../images/empty-main.png)

*The empty editor area with the workspace name and three ways to start.*

With no file, diff or Log open, the editor area shows the workspace name and three shortcuts:

- **Review changes** (Shift+Cmd+G) opens the Changes sidebar.
- **Show the Log** (Shift+Cmd+L) opens the commit history. It is greyed out when there is no repository.
- **Open a file from the Files panel** shows the Files panel.

## Tabs

- Click a tab to show it. Every tab keeps its own cursor, scroll position and unsaved edits while you look at another one.
- A new tab opens right after the current one.
- A dot on the tab means unsaved changes. Hover it to see the close button.
- Middle-click a tab to close it.
- Scroll with the mouse wheel over the tab strip to move through many tabs.
- When two tabs have the same file name, the folder name is shown next to each.

Right-click a tab for **Close**, **Close Others**, **Close to the Right**, **Close All**, **Copy Path** and **Copy Relative Path** (a preview tab also has **Keep Open**). If a tab you close has unsaved changes, you are asked before they are thrown away. Closing or switching the folder asks the same way.

There is also a **Diff** tab, always first, with the file name and the word Diff. It appears when you select a file in Changes and shows that file's [diff](Diffs.md). Its close button clears the selection.

## Breadcrumbs and badges

The row above the editor shows where the file lives: the workspace folder, then each folder down to the file. Repository folders are marked with a git icon. The copy button at the end copies the relative path.

Badges next to the path tell you about the file:

- **Unsaved**: you have edits that are not saved yet.
- **Modified**, **New file** or **Conflicted**: what git thinks of the file.
- **2 conflicts** (or similar): how many conflict blocks are in the text.

## The toolbar

Below the breadcrumbs is a row of buttons. It wraps onto more lines when the editor is narrow, so nothing hides.

- **Up** and **Down** arrows jump to the previous or next change (Shift+F7 and F7), wrapping around at the end of the file. The label reads **2 of 5** while the cursor is in a change, **5 changes** when it is not, or **No changes**. In a file with conflicts it counts **sections**: changes and conflict blocks together.
- **Accept All Current** and **Accept All Incoming** appear when the file has conflict markers. See [Resolving Conflicts](Resolving-Conflicts.md).
- **Resolve in Merge Tool** appears for a file git lists as conflicted. **Mark as Resolved** joins it once no conflict blocks are left.
- **Blame** shows who last changed each line. See [Blame](Blame.md).
- **Revert** reloads the file from disk and drops your unsaved edits (you are asked first).
- **Save** writes the file (Cmd+S). It is greyed out until you edit. Line endings (LF or CRLF) are kept as they were.

The arrows and Blame only appear for files inside a git repository.

## Change markers

![Change markers in the gutter and scrollbar](../images/editor-change-markers.png)

*A green bar beside the new lines, ticks beside the scrollbar, and 2 changes in the toolbar.*

While you edit, Git Manager compares the text with the last commit:

- A thin colored bar next to the line numbers marks added and modified lines. A small mark shows where lines were deleted.
- The strip beside the scrollbar has a tick for every change and conflict, placed along the whole file. Click a tick to jump there. Hover it to see the kind of change and the line.
- Conflict blocks are marked in their own color and win over plain changes.

F7 and Shift+F7 (or the toolbar arrows) move between these changes and conflicts.

## Editing

The editor has the usual basics: line numbers, syntax colors for common languages (JavaScript, TypeScript, JSX, Rust, PHP, HTML, Vue, Svelte, Blade, CSS, SCSS, Less, JSON, Markdown, Python, YAML, SQL), bracket matching, undo and redo, and Tab to indent.

- Cmd+F opens the search bar. Cmd+G or F3 finds the next match.
- Shift+Cmd+G finds the previous match. In the editor this wins over the window shortcut that shows Changes.
- Option+Cmd+G goes to a line number.
- Cmd+D selects the next occurrence of the selected word.

Tab size and word wrap are set in [Settings](Settings.md), Editor. Both apply to files you open afterwards.

Files that change on disk (for example after a checkout, or an edit in another app) reload on their own, as long as you have no unsaved edits in that tab.

## Zoom

Turn on **Change font size with Ctrl + mouse wheel** in Settings, Editor. Then hold Control (or Command) and scroll over an editor, diff or merge pane to make the code bigger or smaller. A trackpad pinch works too. A small badge shows the new size.

## Status bar

While a file is shown, the right side of the status bar shows the cursor position (Ln and Col, plus the selection size), the indentation (**Spaces: 4**), the line endings and the language. Click **Spaces** to open Settings on the **Editor** section. See [Status Bar and Help](Status-Bar-and-Help.md).

## Related

- [Files Panel](Files-Panel.md)
- [Diffs](Diffs.md)
- [Blame](Blame.md)
- [Navigation](Navigation.md)
- [How the editor works (developer)](../developer/How-the-Editor-Works.md)
