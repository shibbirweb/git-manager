# Windows MCP and CLI

How the command line tool works on Windows. The rest of Windows support is on [Windows Support](Windows-Support.md), and the MCP server itself on [How MCP and CLI Work](How-MCP-and-CLI-Work.md).

## The command line tool

A Windows GUI program has no console: `git-manager cli` would print nothing, and cmd and PowerShell would not wait for it or see its exit code. So the tool is its own crate, `src-tauri/cli` (`git-manager-cli`), in a Cargo workspace with the app. The app uses it as a library (`mcp::cli`), so nothing changes on macOS. Its `src/main.rs` builds `git-manager-cli.exe`, a console program: `git-manager-cli cli <command>` runs the tool, and anything else (a folder, nothing) starts the app next to it, which hands a folder to the copy already running.

The crate holds what the tool and the app share: the config folder (`home`), the `mcp.json` format (`server_file`), the client header and the protocol version (a test in the app checks it). It has no build script, which matters: `tauri-build` copies a bundled program while the app compiles, so the program must exist before that.

`build-windows` in `release.yml` therefore builds `git-manager-cli` first, copies it to `src-tauri/binaries/git-manager-cli-x86_64-pc-windows-msvc.exe` and passes `--config src-tauri/tauri.windows-release.conf.json`, which lists it in `bundle.externalBin`. The installer puts it next to the app. Install command line tool then writes `git-manager.cmd` into `%LOCALAPPDATA%\Microsoft\WindowsApps`, which Windows puts on every user's `PATH`, and the `.cmd` runs the console program with all its arguments. It never touches a file that is not ours (`SHIM_MARK`).

## Shells that mangle quotes

Windows PowerShell 5.1 splits an argument that holds both spaces and double quotes, so `--args '{"message": "two words"}'` reaches the tool broken. `name=value` arguments are safe, and `--args-file <file>` (or `--args-file -` for stdin) reads the JSON object without passing it through the command line at all: `'{"limit": 5}' | git-manager cli call git_log --args-file -`.
