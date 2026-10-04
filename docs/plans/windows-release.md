# Windows release

Audit of 2026-10-04: how far the app is from a Windows release, and the work in order. Linux comes later. The
code was read, not built: nothing has been compiled for Windows yet, so step 1 exists to find the compile and test
failures this audit cannot see.

Estimate: about two weeks of focused work for a usable beta, plus manual testing on a real Windows machine or VM.

## Already in place

- Native menu bar per platform (`src/lib/menu/menuSpec.ts`), Cmd mapped to Ctrl.
- Terminal shells: PowerShell 7, Windows PowerShell, Command Prompt and Git Bash, never WSL's `bash.exe`
  (`src-tauri/src/terminal.rs`).
- Script runs: `PATHEXT` lookup, `.cmd` and `.bat` through `cmd.exe /d /c` (`src-tauri/src/run_process.rs`).
- GitHub token in the Windows Credential Manager (`keyring` windows-native), Recycle Bin (`trash`), clipboard
  through PowerShell (`commands/patch.rs`).
- CRLF kept on save and in the merge tool (`merge/model.rs` `Eol`).
- Windows file name rules (`file_ops.rs`), `\` turned into `/` in file search (`file_search.rs`).
- Preview scheme URLs use `http://gmpreview.localhost/` on Windows (`src/lib/views/files/previewSource.ts`).
- `icon.ico` in `tauri.conf.json`, `windows_subsystem = "windows"` in `main.rs`.

## Blockers

1. **Settings cannot be found.** `config::home_dir()` (`src-tauri/src/config.rs`) reads only `HOME`, which Windows
   usually does not set. Settings, state, MCP, GitHub and the window session all fail. Fall back to `USERPROFILE`.
   `workspace_file.rs` (`~` expansion) reads `HOME` too.
2. **PATH broken for git.** `user_path()` in `src-tauri/src/git/cli.rs` starts `/bin/zsh` (no `SHELL` on Windows).
   When that fails it puts `/opt/homebrew/bin:/usr/local/bin:` in front of PATH with `:`, so the first real entry
   (usually `System32`) is lost. Use the app's own PATH on Windows. `git_binary()` candidates are macOS paths
   (harmless, falls back to `git`).
3. **A console window flashes on every git call.** No `CREATE_NO_WINDOW` anywhere. Affects `git/cli.rs`,
   `git/cancel.rs`, `merge/engine.rs` (`git merge-file`), `github/gh.rs`, `commands/patch.rs` (clipboard),
   `run_process.rs`. Add it once in a shared helper.
4. **Paths.** The frontend assumes absolute paths start with `/`, use `/` only and compare case-sensitively
   (`src/lib/stores/workspacePaths.ts`: `normalizePath`, `parentOf`, `isInside`; plus `markdown/links.ts`,
   `terminal/fileLinks.ts`, `mcp/args.ts`, `compare/compareTabs.ts`, `stores/tabSession.ts`, the submodule and
   worktree models). The backend sends `C:\...` (dialogs), `\\?\C:\...` (43 `canonicalize` calls) and `C:/...`
   (git2). Normalize to `C:/Users/...` where paths leave Rust (`dunce` for `canonicalize`), and compare paths
   case-insensitively on Windows. The largest item: days, with Rust and Vitest tests for Windows paths.
5. **No installer.** `tauri.conf.json` bundle targets are `app` and `dmg`. Add `nsis` (maybe `msi`) and a WebView2
   install mode.
6. **No Windows CI.** Every CI and release job runs on `macos-latest`.
7. **Update check is macOS only.** `parseReleases` in `src/lib/update/releases.ts` takes the first `.dmg`; Windows
   users get no download link. Pick the asset per platform.

## Before calling it a beta

- **Single instance.** A second launch on Windows is a second process sharing `state.json` and the MCP port. Add
  `tauri-plugin-single-instance` and forward the folder argument.
- **Process trees.** Cancel (`git/cancel.rs`) and closing a terminal only end the direct child on Windows; ssh,
  remote helpers, hooks and dev servers keep running. Use a Job Object.
- **Command line tool.** `git-manager cli` prints nothing from a GUI-subsystem exe (needs `AttachConsole` or a
  small console exe), installing it is Unix only (`mcp/install.rs`), `process_alive` always says yes (`mcp/cli.rs`).
- **macOS-only features:** memory readout (empty), Clear Cache, MCP screenshot. Hide them or port them.
- **Fonts.** `--font-mono` in `src/app.css` falls back to Courier New; add Cascadia Mono and Consolas.
- **Signing.** Unsigned installers get a SmartScreen "unknown publisher" warning. Needs a certificate or Azure
  Trusted Signing, and a secret in `release.yml`.
- **Wording.** "Reveal in Finder" in Settings (memory log), "Finder" in settings descriptions
  (`settingsData.ts`), Cmd shortcuts and screenshots in the wiki.

## Order

1. Windows CI job (svelte-check, Vitest, cargo test, clippy), allowed to fail until it is green, to list the
   compile and test failures. Then make it required.
2. Blockers 1 to 3.
3. Paths (blocker 4).
4. Installer, update check and a `build-windows` job in `release.yml` (blockers 5 and 7).
5. Single instance, process trees, the beta list, then manual testing on Windows.

## Progress

- Step 1: `windows` job added to `.github/workflows/ci.yml` (not committed). Needs a push to run.
- Step 2 (not committed): `config::home_dir` reads `USERPROFILE` first on Windows, then `HOME` (tested with
  `home_from`); the terminal and workspace files use it too, and the test sandbox moves `USERPROFILE`.
  `git/cli.rs` `user_path()` uses the app's own PATH on Windows (a `cfg(windows)` test checks it).
  `child_process::hide_console` adds `CREATE_NO_WINDOW` to git (`cli::command`, so also cancellable runs and
  identity), gh and the clipboard reader. Not verified on Windows yet: needs the CI job or a Windows machine.
