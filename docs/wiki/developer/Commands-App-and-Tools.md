# Commands: App and Tools

Commands that are not about one repository's git data: files, config, the memory log, search, scripts, the terminal, the Git Console and the MCP server. How to read the columns, the events and the channels are explained in [Commands and Events](Commands-and-Events.md).

## Files

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `list_directory` | `listDirectory(rootPath, dirPath, repoRoots)` | `DirListing` | file | one folder level for the Files panel, the first 5000 in sort order |
| `read_worktree_file` | `readWorktreeFile(repoPath, filePath)` | `FileContent` | file | a file's text for the editor |
| `read_image_data_url` | `readImageDataUrl(rootPath, imagePath)` | `string` | file | a local image for the Markdown preview as a `data:` URL, only from inside the workspace folder |
| `preview_stat` | `previewStat(source)` | `PreviewStat` | file | whether an image or PDF for a preview exists, its size, and the limit when too big; the bytes come from the `gmpreview` scheme (see [How the Preview Scheme Works](How-the-Preview-Scheme-Works.md)) |
| `file_create` | `fileCreate(workspaceRoots, parentDir, name, isDir)` | `string` | file | a new file or folder; a `name` with `/` creates the missing folders too |
| `file_rename` | `fileRename(workspaceRoots, entryPath, newName)` | `string` | file | renames in place; a case-only rename goes through a temporary name |
| `file_copy` | `fileCopy(workspaceRoots, sourcePaths, targetDir)` | `string[]` | file | copies files and folders, symlinks as links; a taken name becomes `cart copy.ts`, `cart copy 2.ts` |
| `file_move` | `fileMove(workspaceRoots, sourcePaths, targetDir)` | `FileMove[]` | file | moves into a folder (copy then delete across volumes); any conflict refuses the whole move |
| `file_trash` | `fileTrash(workspaceRoots, entryPaths)` | `void` | file | Move to Trash with the `trash` crate (NSFileManager on macOS, no automation prompt) |

The file operations take absolute paths and return them in the same form. Each path must be inside one of `workspaceRoots`, and never a workspace folder itself or inside `.git`; symlinks are never followed out of the workspace. `FileMove` is `{ from: string, to: string }`. The code is in `src-tauri/src/file_ops.rs`.

## Config and memory

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `load_config` | `loadConfig(configName)` | `unknown` | file | `settings` or `state` from `~/.gitmanager`; null when missing |
| `save_config` | `saveConfig(configName, value)` | `void` | file | atomic write of the same |
| `config_dir` | `configDir()` | `string` | app | the `~/.gitmanager` path |
| `memory_usage` | `memoryUsage()` | `MemoryUsage` | app | memory of the app and its web view helpers |
| `os_info` | `osInfo()` | `OsInfo` | app | OS name and version for bug reports (`sw_vers`, os-release) |
| `memory_log_configure` | `memoryLogConfigure(enabled, intervalMs, thresholdMb)` | `MemoryLogStatus` | app | starts or stops the debug memory log in `~/.gitmanager/logs/memory.log` |
| `memory_log_event` | `memoryLogEvent(label)` | `void` | app | a UI event (tab, view, scroll start or stop) for the next log line |

`OsInfo` is `{ name: string, version: string | null }`.

## Search Everywhere and Replace in Files

Each takes the open workspace folders as `workspaceRoots`. The indexes live in `AppState.file_search` only while the popup is in use. See [How Search Everywhere Works](How-Search-Everywhere-Works.md) and [How Find and Replace Works](How-Find-and-Replace-Works.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `file_search_open` | `fileSearchOpen(workspaceRoots, progress)` | `FileSearchProgress` | app | starts or reuses the file index and returns at once; progress goes to the channel |
| `file_search_query` | `fileSearchQuery(workspaceRoots, query, limit)` | `FileSearchResults` | app | fuzzy matches against what is indexed so far; never waits |
| `file_search_close` | `fileSearchClose()` | `void` | app | the popup closed; the index stays a short while so reopening is instant |
| `symbol_search_open` | `symbolSearchOpen(workspaceRoots, progress)` | `SymbolSearchProgress` | app | starts or reuses the symbol index (Classes and Symbols tabs) |
| `symbol_search_query` | `symbolSearchQuery(workspaceRoots, query, scope, limit)` | `SymbolSearchResults` | app | matches symbols; `scope` is `classes`, `all` or `members` |
| `text_search` | `textSearch(workspaceRoots, searchId, query, options, results)` | `void` | file | Find in Files: batches stream to `results`; a newer `searchId` stops the old search |
| `text_search_cancel` | `textSearchCancel(searchId)` | `void` | app | stops that search |
| `replace_in_files` | `replaceInFiles(workspaceRoots, replaceId, request)` | `ReplaceOutcome` | file | replaces the Text tab's matches, or only counts them with `request.preview`; skips files with unsaved edits |
| `replace_in_files_cancel` | `replaceInFilesCancel(replaceId)` | `void` | app | stops it between files |

## Scripts

See [How Scripts Work](How-Scripts-Work.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `list_project_scripts` | `listProjectScripts(folderPaths)` | `ScriptSource[]` | file | scripts of every `package.json`, `composer.json`, `Makefile`, `deno.json` and `justfile`, rescanned on every call |
| `list_node_versions` | `listNodeVersions()` | `NodeInstall[]` | file | Node versions installed by nvm, Herd, fnm, Volta, asdf, mise, nodenv, n and Homebrew, newest first |
| `run_script` | `runScript({ program, args, cwd, nodeBinDir, cols, rows }, output)` | `TerminalInfo` | app | starts a script as its own process in a PTY (the Run tab), with the login shell's environment |

## Terminal

Output arrives as raw bytes on `output`, the end as a `terminal-exited` event. Script runs use `terminal_write`, `terminal_resize` and `terminal_close` too. See [How the Terminal Works](How-the-Terminal-Works.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `terminal_shells` | `terminalShells()` | `ShellProfile[]` | app | the installed shells (from `/etc/shells` on macOS and Linux), login shell first |
| `terminal_spawn` | `terminalSpawn({ shellId, cwd, cols, rows }, output)` | `TerminalInfo` | app | starts a shell in a pseudo terminal (PTY) |
| `terminal_write` | `terminalWrite(terminalId, data)` | `void` | app | queues keystrokes for the terminal's writer thread; synchronous on purpose |
| `terminal_resize` | `terminalResize(terminalId, cols, rows)` | `void` | app | resizes the PTY |
| `terminal_close` | `terminalClose(terminalId)` | `void` | app | hangs up the shell and its jobs, and kills them after a grace period |
| `terminal_close_all` | `terminalCloseAll()` | `void` | app | closes every terminal, for example after a window reload |

## Git Console

See [How the Git Console Works](How-the-Git-Console-Works.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `git_console_entries` | `gitConsoleEntries()` | `GitCommandEntry[]` | app | every recorded git command, oldest first; the first call starts the `git-command` events |
| `git_console_clear` | `gitConsoleClear()` | `void` | app | empties the list |
| `git_console_set_enabled` | `gitConsoleSetEnabled(enabled)` | `void` | app | the Git Console setting; off records nothing and frees the entries |

## MCP server and command line tool

Both switches off: nothing listens and no thread runs. See [How MCP and CLI Work](How-MCP-and-CLI-Work.md).

| Command | Wrapper | Returns | Kind | What it does |
| --- | --- | --- | --- | --- |
| `mcp_configure` | `mcpConfigure(enabled, cliEnabled, port, toolStates)` | `McpStatus` | app | starts, restarts or stops the server on `127.0.0.1`; `toolStates` holds only tools switched from their default |
| `mcp_status` | `mcpStatus()` | `McpStatus` | app | whether it runs, its port, URL and token, and the command line tool's install state |
| `mcp_tools` | `mcpTools()` | `McpToolInfo[]` | app | backend and UI tools with their effective on or off state |
| `mcp_register_ui_tools` | `mcpRegisterUiTools(tools)` | `void` | app | the tools the window runs, sent once at start |
| `mcp_set_workspace` | `mcpSetWorkspace(folderPaths)` | `void` | app | the folders tools and the `gmpreview` scheme may touch: the workspace folders open now |
| `mcp_ui_respond` | `mcpUiRespond(requestId, result)` | `void` | app | the window's answer to an `mcp-ui-request`; a late answer is dropped |
| `mcp_regenerate_token` | `mcpRegenerateToken()` | `McpStatus` | file | a new secret token in `~/.gitmanager/mcp.json` |
| `mcp_activity` | `mcpActivity()` | `McpActivity[]` | app | the last 50 calls, newest last |
| `cli_install` | `cliInstall()` | `McpStatus` | file | links `~/.local/bin/git-manager` to this binary (not on Windows yet) |
| `cli_uninstall` | `cliUninstall()` | `McpStatus` | file | removes that link, only when it is ours |
