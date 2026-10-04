# Menus

Git Manager has a real menu bar, like every other Mac app. Every command lives in it, with its keyboard shortcut next to it.

On macOS the menus are at the top of the screen: **Git Manager**, **File**, **Edit**, **View**, **Code**, **Git**, **Window** and **Help**. The planned Windows and Linux builds put the menu bar in the window and have no Git Manager menu: **Settings...** and **Exit** sit at the end of File, and **Check for Updates...** and **About Git Manager** at the end of Help.

## Git Manager

- **About Git Manager** opens Settings on the About page.
- **Check for Updates...** looks for a new version now. See [Updates](Updates.md).
- **Settings...** (Cmd+,) opens [Settings](Settings.md).
- Then the usual Mac items: Services, Hide Git Manager (Cmd+H), Hide Others, Show All and Quit Git Manager (Cmd+Q).

## File

- **New File** (Cmd+N) opens an empty Untitled tab; Save asks where to write it. See [New File and Unsaved Changes](New-File-and-Unsaved-Changes.md).
- **Open Folder...** and **Open Workspace from File...** open something new. **Open Recent** lists your recent workspace files, workspaces and folders (not the one that is open now), and **Clear Recent** empties the list. See [Workspaces](Workspaces.md).
- **Add Folder to Workspace...** and **Save Workspace As...** need an open folder.
- **Save** (Cmd+S) saves the file on screen, **Save All** (Option+Cmd+S) saves every edited file, and **Revert File** throws away the unsaved edits of the file on screen. The editor has no Save and Revert buttons of its own: these menu items replace them.
- **Close Tab** (Cmd+W) closes the editor tab or diff on screen. It never closes the window.
- **Close Folder** closes what is open. With several folders open it reads **Close Workspace**.

## Edit

- **Undo** (Cmd+Z) and **Redo** (Shift+Cmd+Z) work on the place you are typing: the editor keeps its own history, and a text field its own.
- **Cut**, **Copy**, **Paste**, **Delete** and **Select All** (Cmd+A).
- **Find...** (Cmd+F), **Replace...** (Cmd+R), **Find Next** (Cmd+G), **Find Previous** (Shift+Cmd+G) and **Select All Occurrences** (Ctrl+Cmd+G) work in the editor that has the keyboard. See [Find and Replace](Find-and-Replace.md).
- **Find in Files...** (Shift+Cmd+F), **Replace in Files...** (Shift+Cmd+R), **Go to File...** (Cmd+P), **Recent Files...** (Cmd+E, see [Recent Files](Recent-Files.md)), **Jump to Navigation Bar** (Cmd+Up, see [Navigation Bar](Navigation-Bar.md)), **Go to Class...** (Cmd+O), **Go to Symbol...** (Option+Cmd+O) and **Search Everywhere** (press Shift twice). See [Search Everywhere](Search-Everywhere.md).

## View

A tick shows what is on screen now.

- **Changes**, **Branches and Stashes** (Shift+Cmd+E), **Scripts**, **Log** (Shift+Cmd+L), **Files Panel** (Option+Cmd+B), **Sidebar** (Cmd+B) and **Terminal** (Ctrl+\`).
- **Git Console** shows only while it is turned on in Settings, Git. See [Git Console](Git-Console.md).
- **Left Activity Bar** and **Right Activity Bar** show or hide the icon strips at the window edges.
- **File Icons** picks **No Icons**, **Minimal** or **Material Icons** for the file lists. See [File Icons](File-Icons.md).
- **Word Wrap** (Option+Z) wraps long lines in the file editor. See [Editing Code](Code-Appearance.md#word-wrap).
- **Markdown** picks **Editor Only**, **Editor and Preview** or **Preview Only** for a Markdown file. See [Markdown Editor](Markdown-Editor.md).
- **Appearance** picks **Light**, **Dark** or **System**.
- **Zoom In** (Cmd+=), **Zoom Out** (Cmd+-) and **Reset Zoom** (Cmd+0) change the size of the code text.
- **Enter Full Screen** (macOS only).

Changes shows no key, because Shift+Cmd+G is Find Previous; outside an editor that key still shows Changes.

## Code

These items act on the editor that has the keyboard: comments, duplicate, delete, join, move and indent lines, toggle case, sort lines, folding, **Go to Line...** (Cmd+L) and **Select Next Occurrence** (Cmd+D). Items that change text are grey in a read-only editor (one you can look at but not type in). [Editing Code](Editing-Code.md) has the full table with every key.

## Git

The Git menu has everything git: commit, push, pull, merge, rebase, patches, the current file's history and more, in the style of JetBrains IDEs. It has its own page: [Git Menu](Git-Menu.md).

## Window

**Minimize** (Cmd+M), **Zoom**, **Next Tab** (Shift+Cmd+]), **Previous Tab** (Shift+Cmd+[) and **Bring All to Front**. On Windows and Linux the tab keys are Ctrl+PageDown and Ctrl+PageUp.

## Help

- **Git Manager Help** opens this wiki.
- **Keyboard Shortcuts** opens a window with every shortcut, grouped by menu. Type in its filter to find a key or an action. **Open Online Version** opens [Keyboard Shortcuts](Keyboard-Shortcuts.md) in the browser.
- **What's New** and **Release Notes** show what changed.
- **Available MCP Tools...** lists what AI tools may do in the app. See [MCP and CLI](MCP-and-CLI.md).
- **Report a Bug...**, **Request a Feature...** and **Star on GitHub**. See [Status Bar and Help](Status-Bar-and-Help.md).

![The Keyboard Shortcuts window filtered to the Git menu](../images/menus-shortcuts-window.png)

*Help > Keyboard Shortcuts, filtered with "git menu": each row is a menu item and its keys.*

## Grey items, ticks and names that change

The menus follow what you are doing:

- An item is grey when it cannot act now. For example Save without unsaved changes, the Code items when no editor has the keyboard, or the Git items while a git command runs.
- Some names change. **Close Folder** becomes **Close Workspace**, **Push...** becomes **Push (2 ahead)...** and **Pull...** becomes **Pull (1 behind)...**. Ahead means commits you have that the remote does not; behind means the other way round.
- Some items appear only when they apply, like **Continue Merge** and **Abort Merge** during a merge.

While a dialog in the app asks you something, most menu items do nothing. Typing items such as Undo, Cut, Copy, Paste and Select All still work in the dialog's fields, and so do the Help links (Git Manager Help, Release Notes, Report a Bug..., Request a Feature... and Star on GitHub).

## When a key means two things

The part of the window you are working in sees a key first. When it uses the key, the menu item does not run as well, so one press never does two things.

That is why a few keys depend on where you are. Cmd+K is **Commit...** in the Git menu, but it makes a link in the Markdown editor and clears the screen in the terminal. Cmd+B is **Sidebar** in the View menu, but it makes text bold in a Markdown file.

The Git menu keys (Cmd+K, Cmd+T, Cmd+9 and Option+Cmd+A) are Mac only, because Ctrl+K and Ctrl+T belong to the shell in a terminal on Windows and Linux.

## The mergetool window

When git starts Git Manager as its merge tool (see [Git Mergetool](Git-Mergetool.md)), the window has a smaller menu bar. On macOS it is the Git Manager menu with **Settings...**, **Edit**, **Window** and **Help**; on Windows and Linux a **File** menu with **Settings...** and **Exit** takes the place of the Git Manager menu. There, Window has **Close Window** (Cmd+W), which asks before it drops an unsaved merge result.

## Related

- [Git Menu](Git-Menu.md)
- [Keyboard Shortcuts](Keyboard-Shortcuts.md)
- [Editor and Tabs](Editor-and-Tabs.md)
- [How the menus work (developer)](../developer/How-the-Menus-Work.md)
