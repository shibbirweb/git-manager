# Troubleshooting

Common problems with the app and how to fix them. Problems with git itself (git not found, hooks, signing in, push and checkout errors) are on [Troubleshooting Git](Troubleshooting-Git.md). If yours is not on either page, use **Report a Bug** in the status bar (see [Status Bar and Help](Status-Bar-and-Help.md)).

## macOS will not open the app

Builds are not signed by Apple yet, so the first launch shows an "unidentified developer" warning.

1. In Applications, right-click (or Control-click) **Nibtree** and choose **Open**.
2. Click **Open** in the warning.

On newer macOS versions this may not offer Open. Then try to open the app once, go to **System Settings, Privacy and Security**, scroll down and click **Open Anyway**. As a last resort, this Terminal command removes the download mark:

```sh
xattr -dr com.apple.quarantine "/Applications/Nibtree.app"
```

You only need to do this once per download.

## Windows will not run the installer

The installer is not signed yet, so Windows SmartScreen shows "Windows protected your PC". Click **More info**, then **Run anyway**. If your browser blocked the download, keep it from the browser's downloads list first.

## A repository is missing

The folder scan goes six levels deep and skips folders such as `node_modules`, `vendor`, `build`, `dist`, `target` and `.venv`. It does not follow symbolic links.

- A repository you clone or create in the folder shows up on its own after a moment. If it does not (for example when file watching is unavailable), choose **Scan for Repositories** in the folder menu.
- For a repository deeper down or inside a skipped folder, add it directly with **Add Folder to Workspace...**.

## Changes do not show up

Nibtree watches your folders and refreshes on its own. If you see "File watching is unavailable for" and a folder name, use the refresh buttons in Changes, the Files panel and the Log.

## A file will not open

Files over 4 MB and binary files are not opened in the editor. Folders with more than 5000 entries show only the first 5000 (folders first, then by name) in the Files panel.

## Settings were reset, or are not saved

- **"settings.json could not be read"** at the top of Settings means the file has a mistake, such as a missing comma. Nibtree uses the defaults and does not overwrite your file. Fix it and click **Try Again**, or click **Reset to Defaults**.
- **"state.json could not be read"** means recent folders, the last session and panel sizes could not be loaded. The file is not overwritten. Fix it and click **Try Again**, or click **Reset** in that banner to start a fresh one.
- **"Could not save settings"** usually means `~/.nibtree` (`C:\Users\<you>\.nibtree` on Windows) is not writable. Check its permissions.

See [Settings](Settings.md).

## The update check fails

Automatic checks fail quietly when you are offline. **Check Now** in Settings, Updates shows the reason, such as "GitHub rate limit reached, try again later" (wait a while) or "The update check timed out" (the network is slow or blocked). See [Updates](Updates.md).

## git mergetool does not open Nibtree

Check the command git uses:

```sh
git config --global --get mergetool.nibtree.cmd
```

The path must point to `Contents/MacOS/nibtree` inside the app on a Mac, or to `nibtree.exe` in `AppData/Local/Nibtree` on Windows. See [Git Mergetool](Git-Mergetool.md).

## An AI tool or nibtree cannot connect

See [MCP Server and Command Line Tool](MCP-and-CLI.md) for the setup. Common messages:

- **"Nibtree is not running, or its MCP server and command line tool are both off."** Start the app and turn on **Command line tool** (or **MCP server**) in Settings, Automation.
- **"The command line tool is turned off in Nibtree settings"** or **"The MCP server is turned off..."**: each kind of client needs its own switch.
- **"Missing or wrong bearer token"**: the token changed, for example after **New Token**. Copy the connect command again.
- The **Status** line says the port is in use: another program has it. Pick another **Port**, then copy the connect command again.
- **`nibtree: command not found`**: click **Install in ~/.local/bin** (**Install** on Windows), add the line Settings shows to `~/.zshrc` on a Mac, and open a new terminal.
- **"This tool is turned off in Nibtree (Help > Available MCP Tools)."**: turn it on there.
- **"Not inside an open workspace folder"**: tools only reach the folders open in the app. Open that folder first.
- A screenshot fails: allow Nibtree in **System Settings, Privacy and Security, Screen Recording**.

## Memory keeps growing

Turn on **Log memory changes** in Settings, Automation, Memory log, do what makes it grow, then turn it off. Attach `~/.nibtree/logs/memory.log` (**Reveal in Finder**, or **Reveal in File Explorer** on Windows, shows it) to your bug report: it shows each change next to what was on screen. See [Status Bar and Help](Status-Bar-and-Help.md).

## The memory number looks different

When started from a Terminal, macOS counts the app's helper processes differently, so they are matched by start time and the number is approximate. On Windows the number is Task Manager's Memory column (the private working set) for the app and its WebView2 processes.

## Related

- [Troubleshooting Git](Troubleshooting-Git.md)
- [Getting Started](Getting-Started.md)
- [Remotes](Remotes.md)
- [Settings](Settings.md)
- [Updates](Updates.md)
- [MCP Server and Command Line Tool](MCP-and-CLI.md)
- [Developer Guide](../developer/Developer-Guide.md)
