# Windows Support

Windows support is being built (the work list is in `docs/plans/windows-release.md`). This page explains what the code already does differently on Windows, and the rules that keep it working. For builds and signing, see [Platforms and Signing](Platforms-and-Signing.md).

## Helper processes without a console window

A Windows program built as a GUI app has no console. When it starts a console program such as `git.exe`, Windows opens a new console window for it, so every git call would flash a black window. `child_process::hide_console` (`src-tauri/src/child_process.rs`) sets the `CREATE_NO_WINDOW` flag. `git::cli::command` uses it, so every git call gets it, and so do `gh auth token` and the PowerShell clipboard reader. Use it for any new helper process.

## The home folder and PATH

- `config::home_dir` reads `USERPROFILE` first on Windows, then `HOME`. `HOME` is usually unset there, and when Git Bash sets it, an app started from the Start menu does not see it, so the app and the command line tool would use different config folders. The test sandbox in `test_support.rs` moves both.
- `git::cli::user_path` asks the login shell for `PATH` on macOS and Linux, because apps started from Finder get a short one. On Windows the app already gets the user's full `PATH`, so it is used as it is.

## Paths

Absolute paths always use `/`, on Windows too (`C:/Users/me/repo`), so the page's path helpers work the same everywhere. On Windows, `canonicalize` returns `\\?\C:\...`, which git cannot use, and `Path::join` adds `\`. So:

- the backend gets real paths only from `paths::real` or `RealPath::real_path` in `src-tauri/src/paths.rs` (built on `dunce`; `clippy.toml` forbids `canonicalize`);
- every absolute path for the page goes through `paths::to_ui` (or `serialize_ui` on a serde field), which also writes the drive letter in upper case;
- on the page, `fromNativePath` converts what the system hands over directly (dialogs, dropped files), and `isAbsolutePath`, `rootOf`, `parentOf` and `normalizePath` in `workspacePaths.ts` know the `C:/` and `//server/share/` roots.

## Installer and releases

`src-tauri/tauri.windows.conf.json` is merged over `tauri.conf.json` on Windows. Its bundle targets replace the macOS ones with `nsis`: a per-user installer (`installMode: currentUser`, no administrator rights) that downloads WebView2 when it is missing. `build-windows` in `release.yml` builds it on `windows-latest` and attaches the `-setup.exe` to the release, but only when the repository variable `WINDOWS_RELEASES` is `true`. That switch keeps betas from offering a Windows download before Windows support is finished. The update check offers that `-setup.exe` to Windows users (`downloadAsset` in `src/lib/update/releases.ts`).

The installer is not signed yet, so Windows SmartScreen warns about an unknown publisher.

## Code written for Windows

The terminal, the Scripts panel and the command line tool already have Windows paths behind `cfg(windows)` or runtime checks. The `windows` job in `ci.yml` builds and tests them on every pull request.

| Where | On Windows |
| --- | --- |
| `src-tauri/src/terminal.rs` | Shells: PowerShell (`pwsh.exe` on `PATH` or in `Program Files\PowerShell\7`), Windows PowerShell, Command Prompt (`%ComSpec%`, always listed) and Git Bash (`Git\bin\bash.exe` under Program Files or `%LOCALAPPDATA%\Programs`, never from `PATH`, where `bash.exe` is WSL). The first found is the default. Killing uses `TerminateProcess`. |
| `src-tauri/src/node_versions.rs` | nvm-windows (`NVM_HOME` or `%APPDATA%\nvm`), fnm, Volta and Scoop, with `node.exe` right in each version folder. |
| `src-tauri/src/run_process.rs` | No login shell is read (Explorer gives apps the full environment). Programs are found with `PATHEXT`, and `.cmd` files such as `npm.cmd` start through `cmd.exe /d /c`. |
| `src/lib/terminal/keys.ts`, `src/lib/views/files/reveal.ts` | Ctrl+Shift+C and Ctrl+Shift+V copy and paste; "Reveal in File Explorer". |
| `src-tauri/src/mcp/cli.rs`, `install.rs` | `git-manager cli` prints nothing in a release build, which has no console; installing the command link is Unix only. |

See [How the terminal works](How-the-Terminal-Works.md) and [How scripts work](How-Scripts-Work.md).

## Tests

- `paths.rs`: Windows paths get `/` and an upper case drive; Unix paths are left alone.
- `config.rs`: the home folder lookup order on both platforms.
- `git/repo.rs` and `git/cli.rs`: tests behind `cfg(windows)` that only the Windows CI job runs.
- `workspacePaths.test.ts`, `fileLinks.test.ts` and `args.test.ts`: drive roots, `fromNativePath` and MCP paths.
- The test sandbox (`test_support.rs`) takes its home folder from `real_path`, and `path_string` and `file_string` return paths the way the page sends them (`to_ui`). The first Windows CI run failed in most git tests because the sandbox used `canonicalize`: git cannot read its config files at a `\\?\` path.
- `test_support::UiText` (`path.ui()`) gives a path the way the app returns it, for expected values. Tests that need a Unix-only tool or a missing Windows feature are marked `#[cfg_attr(windows, ignore = "why")]`, so they still show in the output.

## Bugs we fixed

**Local History refused every file on Windows.** `check_file_path` wanted the path to start with `/`, so a `C:/...` path was "invalid" and no snapshot was ever written. The Windows CI run showed it. Now `paths::after_root` accepts `/` or, on Windows, a drive root, and the rest of the check is unchanged, so `.` and `..` parts are still refused.

**A rooted path could leave the work tree on Windows.** `safe_join` and the submodule path check refused absolute paths with `is_absolute()`. On Windows `\etc\passwd` has a root but no drive, so it is not "absolute", and joining it onto the repository gives a path at the drive root. Both checks now also refuse `Component::RootDir`, like the MCP path check already did.
