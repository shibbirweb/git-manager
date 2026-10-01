# Getting Started

Git Manager is a small, fast Git app for macOS. It shows what changed in your projects, lets you commit, switch branches and sync with a server, and has a friendly three pane tool for fixing merge conflicts.

## Install

1. Open the [Releases page](https://github.com/shibbirweb/git-manager/releases) on GitHub.
2. Under the newest release, download the `.dmg` file. It works on both Apple Silicon and Intel Macs.
3. Open the `.dmg` and drag **Git Manager** into your **Applications** folder.
4. The first time only: builds are not signed by Apple yet, so macOS warns about an "unidentified developer". Right-click (or Control-click) the app in Applications and choose **Open**, then **Open** again in the warning. After that it opens normally. If macOS still refuses, see [Troubleshooting](Troubleshooting.md).

Git Manager uses the `git` already installed on your Mac for every change it makes, so your hooks, passwords and signing keys work the same as in the Terminal. If you have never used git on this Mac, install it first (for example with `xcode-select --install`).

## First launch

When nothing is open you see the welcome screen.

![Welcome screen](../images/welcome.png)

*The welcome screen with recent workspaces and folders.*

- **Open Folder...** picks any folder. It can be one repository (a project folder that git tracks), a folder with many repositories inside, or a plain folder with no git at all.
- **Open Workspace from File...** opens a saved workspace (see [Workspaces](Workspaces.md)).
- **Recent Workspaces** (saved workspace files and sets of several folders) and **Recent Folders** reopen what you used before. Hover a row and click the x (**Remove from list**) to drop it.
- **Settings**, **Star on GitHub**, **Report a Bug** and **Request a Feature** are small links under the big button.

Next time you start the app, it reopens the folders you had open when you quit. If you closed the folder before quitting, it starts on the welcome screen.

## A tour of the window

![The main window](../images/window-overview.png)

*The main window: Changes on the left, a file in the editor, the Files panel on the right and the status bar at the bottom.*

From top to bottom and left to right:

- **Header** (the top bar). On the left: Back and Forward arrows, the workspace name (click it for the folder menu), the active repository with the number of repositories found (only when the folder is not simply one repository), and the current branch with how many commits you can push or pull (click it to switch branches). On the right: Fetch, Pull, Push, Stash, a light and dark theme toggle, and Settings (Cmd+,). While git is working, a spinner and its progress line show up here too.
- **Left activity bar** (the thin icon strip on the left). It picks what the left sidebar shows: **Changes** (Shift+Cmd+G), **Branches and Stashes** (Shift+Cmd+E), or the **Log** (Shift+Cmd+L, the commit history, which opens in the middle). Click the active icon again to hide it. Cmd+B hides or shows the left sidebar.
- **Left sidebar**. Changes shows your edited files and the commit box. Branches and Stashes shows branches, tags and stashes.
- **Editor area** (the middle). It holds tabs for open files and the Diff tab, which compares a file with its last commit. The Log also opens here. When nothing is open, it shows shortcuts to get started (see [Editor and Tabs](Editor-and-Tabs.md)).
- **Right sidebar** with the **Files panel**, a tree of every file in the workspace. The right activity bar has one icon to show or hide it (Option+Cmd+B).
- **Status bar** (the bottom line). It shows the repository, branch and number of changes of what you are looking at, the cursor position, update notices, Star and feedback buttons, and the app's memory use.

You can drag the edge between a sidebar and the editor to resize it. Double-click the edge to put it back to its normal width.

## Your first commit

1. Open a folder that is a git repository.
2. Edit a file, in Git Manager or any other editor. The change shows up in **Changes** on its own within a moment.
3. Click the file to see its diff, then hover it and click the **+** to **stage** it (staging means "put this in the next commit").
4. Type a message in the commit box and click **Commit**, or press Cmd+Enter.
5. Click **Push** (the up arrow in the header) to send it to the server.

## Next steps

- [Workspaces](Workspaces.md): open several folders and repositories at once.
- [Changes and Commits](Changes-and-Commits.md): staging, discarding and amending.
- [Branches and Tags](Branches-and-Tags.md) and [Remotes](Remotes.md): work with others.
- [Resolving Conflicts](Resolving-Conflicts.md): what to do when a merge stops.
- [Keyboard Shortcuts](Keyboard-Shortcuts.md): every shortcut on one page.

## Related

- [Workspaces](Workspaces.md)
- [Settings](Settings.md)
- [Troubleshooting](Troubleshooting.md)
- [Developer Guide](../developer/Developer-Guide.md)
