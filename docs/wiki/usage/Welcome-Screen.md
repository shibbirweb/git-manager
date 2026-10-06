# Welcome Screen

The welcome screen is what Git Manager shows when no folder is open: at the first start, after **Close Folder**, and in a new window. It looks like the welcome screen of JetBrains IDEs: a sidebar on the left with **Projects**, **Customize** and **Learn**, and your recent projects on the right.

![Welcome screen](../images/welcome.png)

*The Projects page: the search field, Open and Clone, and the recent projects with their colored badges.*

## Projects

**Projects** lists the workspaces and folders you opened before: workspaces first, each kind with the most recent at the top. A workspace is a set of folders you had open together, or a workspace file ([Workspaces](Workspaces.md)). Each project has a colored badge with two letters of its name, so you can spot it at a glance. Below the name you see where it is, with your home folder written as `~`.

- **Click** a project to open it. **Cmd+click** opens it in a new window.
- **Type** in **Search projects** to filter the list. Every word you type must appear in the name or the path.
- **Up** and **Down** pick a project while you type, **Enter** opens it and **Cmd+Enter** opens it in a new window. **Esc** clears the search.
- **Delete** (or **Cmd+Backspace**) with an empty search removes the picked project from the list. The folder itself stays where it is.

Point at a project and click **...**, or right-click it, for more:

- **Open** and **Open in New Window**.
- **Reveal in Finder** shows the folder or workspace file in Finder (not for a workspace with several folders).
- **Copy Path** copies where it is (**Copy Paths** for a workspace with several folders).
- **Remove from Recent Projects** takes it off the list.

The buttons next to the search field start something new:

- **Open** picks a folder to open ([Workspaces](Workspaces.md)).
- **Clone** copies a repository from GitHub or another server ([Clone](Git-Dialogs.md#clone)).
- **...** has **Open Workspace from File...** and **Open Folder in New Window...**.

### Before you open anything

At the first start there are no recent projects yet. The page then says **Welcome to Git Manager** and shows three large buttons: **Open**, **Clone Repository** and **Open Workspace**.

## Customize

**Customize** has the settings people change first, so you can make Git Manager yours before opening a folder:

- **Theme**: System, Light or Dark. System follows the macOS appearance.
- **Color theme** for the mode in use, with a swatch for each theme.
- **Interface font size** and **Editor font size**.
- **Rounded panels** ([Rounded Panels](Rounded-Panels.md)).

Every change applies at once and is saved. **All settings...** opens the Settings window ([Settings](Settings.md)).

## Learn

**Learn** links to help:

- **Documentation** opens this wiki.
- **Keyboard Shortcuts** shows every key ([Keyboard Shortcuts](Keyboard-Shortcuts.md)).
- **What's New** shows the changes in your version.

## The sidebar

The top of the sidebar shows the app name and version. At the bottom, on every page:

- **Star on GitHub** opens the project on GitHub. A star helps other people find it.
- **Report a Bug** opens a new issue with your version and system filled in.
- **Request a Feature** opens a feature request.
- The gear opens **Settings**.

On Windows, use Ctrl instead of Cmd, and **Reveal in Finder** is called **Reveal in File Explorer**.
