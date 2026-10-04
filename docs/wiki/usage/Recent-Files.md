# Recent Files

Recent Files is a small popup that lists the files you worked on last, newest first. It works like **Recent Files** in JetBrains IDEs such as PhpStorm: press Cmd+E, then Enter, and you are back in the file you had open before this one.

[TODO:recent-files.png]

## Open it

Press **Cmd+E** (Ctrl+E on Windows and Linux), or choose **Edit > Recent Files...** in the menu bar. It also works while the caret is in the editor. On the Mac it works from the terminal too; on Windows and Linux, Ctrl+E in the terminal stays with the shell, where it moves to the end of the line.

The list shows each file's type icon, its name, its folder, and its git state in color, the same colors as in the [Files Panel](Files-Panel.md). A small dot after the name means the file has unsaved edits.

When your workspace has several folders, each folder path starts with the workspace folder's name.

## Jump back and forth

The file on screen is first in the list, and the file **before** it is already selected. So:

- **Cmd+E, then Enter** switches to the previous file.
- Press it again and you are back where you started.

This is the quickest way to move between the two files you are working on.

## Move around

- Type to filter the list. The letters you type must appear in order in the file's folder and name, but not next to each other: `crt` finds `cart.ts`. The list keeps its order, newest first.
- **Up** and **Down** (or Ctrl+N and Ctrl+P) move the selection. They wrap around at the ends. **Page Up** and **Page Down** jump ten rows.
- **Enter** opens the selected file. A click does the same.
- **Cmd+Enter** opens it in the other editor group, when the [split editor](Editor-and-Tabs.md#tabs) is on.
- **Esc**, or a click outside the popup, closes it and puts the focus back where it was.

## Edited files only

Press **Cmd+E again** while the popup is open, or click **Edited only** at the top, to see only the files you changed in Git Manager. The title changes to **Recently Edited Files**. Press it once more to see every file again.

A file counts as edited as soon as you type in it, even before you save.

## Remove a file from the list

Select a file and press **Delete** (on a Mac keyboard without a Delete key, Cmd+Backspace while the filter is empty), or click the **x** at the end of its row. This only takes it off the list; the file itself is not touched.

If a file was deleted or moved outside Git Manager, choosing it shows a short note, and it is taken off the list for you.

## What gets on the list

- Every file you show in the editor joins the list, at the top. Opening a file from the [Files Panel](Files-Panel.md), [Search Everywhere](Search-Everywhere.md), Quick Open, a link or Back and Forward all count.
- Terminal, commit and Git tabs are not files, so they never join it.
- The list holds the last 50 files.

Each workspace has its own list, and it is kept when you quit, so it is still there the next time you open the same folder or workspace. It is stored in `~/.gitmanager/state.json`. See [Settings](Settings.md).

The same list feeds the **Recent Files** section of [Search Everywhere](Search-Everywhere.md) and the **Recently opened** section of Quick Open (Cmd+P), so all three agree.

## Turn it off

Recent Files is on by default. To turn it off, open **Settings > Editor** and switch off **Recent Files** under **Tabs**.

While it is off:

- Git Manager does not keep the list. That saves very little: the mark beside the setting says **about +1 MB**, which is within what we can measure. The popup itself uses about 17 MB more only while it is open, and gives it back when it closes.
- Cmd+E shows a short note that Recent Files is off, with an **Open Settings** button that takes you to the setting.
- Quick Open and Search Everywhere show only the file on screen and your open tabs as recent files.

The lists already saved are kept. Turn the setting on again and each workspace gets its list back.

## In the commit message

While you type a commit message, Cmd+E opens your earlier commit messages instead, as in JetBrains IDEs. You can turn that off with **Settings > Git > Message history**; then Cmd+E opens Recent Files there too. See [Changes and Commits](Changes-and-Commits.md).

## Related

- [Search Everywhere](Search-Everywhere.md)
- [Navigation](Navigation.md)
- [Editor and Tabs](Editor-and-Tabs.md)
- [Keyboard Shortcuts](Keyboard-Shortcuts.md)
