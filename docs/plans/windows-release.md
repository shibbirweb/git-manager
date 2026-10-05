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

- Step 1: `windows` job added to `.github/workflows/ci.yml` (`9761593`).
- Step 2 (`9761593`): `config::home_dir` reads `USERPROFILE` first on Windows, then `HOME` (tested with
  `home_from`); the terminal and workspace files use it too, and the test sandbox moves `USERPROFILE`.
  `git/cli.rs` `user_path()` uses the app's own PATH on Windows (a `cfg(windows)` test checks it).
  `child_process::hide_console` adds `CREATE_NO_WINDOW` to git (`cli::command`, so also cancellable runs and
  identity), gh and the clipboard reader. Not verified on Windows yet: needs the CI job or a Windows machine.
- First Windows CI run (PR, 2026-10-05): svelte-check, Vitest and the frontend build pass. The app code compiles.
  The test build and clippy failed on six Unix-only items; fixed in `f34ac11`.
- Step 3 done (`f3ec85e`). Rust: `src-tauri/src/paths.rs` (`real`, `RealPath::real_path` through `dunce`,
  `to_ui`, `serialize_ui`), `clippy.toml` forbids `canonicalize`, every root and absolute path for the page goes
  through `to_ui` (`strip_trailing_slash` included). Page: `fromNativePath` on dialog and drop results,
  `isAbsolutePath` and `rootOf` in `workspacePaths.ts` (`parentOf` and `normalizePath` keep the `C:/` root),
  Windows forms in terminal links (`parseOsc7` with `/C:/`), MCP path arguments, worktree and submodule checks.
  Docs: new developer page `Windows-Support.md`, CLAUDE.md path rule.
  Left for the beta list: case-insensitive path comparisons, and terminal links printed with `\`.
- Second Windows CI run (`f34ac11`, before step 3): the build passes. Most git tests failed with "unknown error
  occurred while reading the configuration files": the sandbox home and `GIT_CONFIG_GLOBAL` were `\\?\` paths, fixed
  by step 3 (`real_path`). `git::compare` failed on `\` from joining onto a `\\?\` path (same fix; test strings
  now use `to_ui`). `text_search` and `merge::engine` failed with messages cut off, most likely the same cause.
  Clippy: `node_at` and three `TerminalRegistry` test helpers are only used by Unix tests, now gated (`f3ec85e`).
- Step 4: `src-tauri/tauri.windows.conf.json` (NSIS, per-user, WebView2 bootstrapper);
  `build-windows` job in `release.yml`, off until the repository variable `WINDOWS_RELEASES` is `true`;
  `downloadAsset` in `releases.ts` offers the `-setup.exe` (else `.msi`) on Windows. Developer docs updated. User
  pages (Getting Started, Updates) stay macOS only until Windows releases are switched on: update them then.
- Third Windows CI run (`f3ec85e`): build and clippy pass; 565 of 612 tests pass, 47 fail. Fixed:
  tests now compare with `to_ui` paths (`test_support::UiText`); Local History refused `C:/` paths
  (`paths::after_root`); `safe_join` and the submodule check now refuse `RootDir` (`\etc` escaped on Windows);
  `untracks_names_with_glob_characters_literally` uses `[ab]` (no `*` in Windows names); unsaved tests use a
  `C:/` tab path; the conflict demo script tests and the two cancel tests are ignored on Windows with a reason
  (cancel needs a Job Object: beta list). Not understood yet (messages cut off): the MCP CLI tests, the recorder,
  identity includes, scripts, workspace files, stdin staging. Read them in the next run.
- Step 5, started: Cascadia Mono and Consolas in the code font list (`app.css`,
  `DEFAULT_EDITOR_FONT`; the earlier default loads as the new one), the memory log button uses `revealLabel`, and
  the terminal drop hint no longer says Finder.
- Single instance: `tauri-plugin-single-instance` on Windows only (not for the merge tool);
  `on_second_launch` opens the folder or workspace file of a second start, or focuses the window showing it.
  Needs a manual check on Windows.
- Fourth Windows CI run (`d275fca`): 602 pass, 8 fail, 4 ignored. Fixed: the MCP server closed
  a refused connection with the body unread, and Windows reset it before the CLI read the answer
  (`close_after_refusal`); tests: a `C:/` include path in git config, no `"` or newline in Windows file names and
  shorter names (git's 260 character limit), `C:/` paths where a test needs an absolute path, and the memory
  recorder test is macOS only.
- Fifth Windows CI run (`b487204`): everything passes on Windows (svelte-check, Vitest, build, cargo test, clippy),
  with the single instance code compiled for the first time. `continue-on-error` is dropped: the job is a gate now.
- Cancel on Windows: `git/cancel.rs` puts git in a Job Object and Cancel ends the job, so hooks
  and helpers stop too; the two cancel tests run on Windows again. Compiles only on Windows: check the CI run.
- CI split (`c7e4cee`): `windows-frontend` (1.1 min) and `windows-rust` (11.7 min) run side by side.
- Command line tool: its own crate `src-tauri/cli` (`git-manager-cli`) in a Cargo workspace; the app
  uses it as `mcp::cli`. Its console program `git-manager-cli.exe` runs `cli ...` or starts the app.
  `build-windows` builds it first and bundles it (`tauri.windows-release.conf.json`, `bundle.externalBin`).
  Install command line tool writes `git-manager.cmd` into `%LOCALAPPDATA%\Microsoft\WindowsApps`. CI and the
  docs use `cargo test --workspace` and `cargo clippy --workspace`. Needs a manual check with a real installer.
- Installer from CI: `windows-installer.yml` on every pull request builds the installer like
  `build-windows`, installs it silently, runs `git-manager-cli cli status` (must answer "not running", code 2)
  and keeps the `-setup.exe` as an artifact for 14 days. Use it for the manual test.
- Manual test over SSH (2026-10-05, PC on 10.10.1.108): the installed app, `git-manager cli` (status, tools, call),
  a second launch (opens the folder in the running app, still one process) and stage plus commit through the CLI
  all work; paths come back as `C:/...`. Cancel can only be pressed in the app (CI covers it).
  Found: libgit2 refuses a repository owned by the Administrators group (made in an elevated terminal) while git
  accepts it, so the app says "Not a git repository" there. Decision: turn off libgit2's owner check on Windows
  (git keeps its own check for every write). Windows PowerShell 5.1 drops `"` inside arguments: `--args` JSON needs `\"`.
- OS version: `os_info` reads `ver` on Windows ("11 build 26200.8037").
- Admin-owned repositories: `git::repo::configure_libgit2` turns off libgit2's owner check on
  Windows at start. Verified on the PC with the `7679e88` installer: the test repository owned by
  `BUILTIN\Administrators` reads fine (`git_status`, `git_log`), and `get_app_info` shows "Windows 11 build 26200.8037".
- Round of tool tests over SSH (2026-10-05): write_file with CRLF, diff, commit, terminal (Windows PowerShell 5.1
  in the folder), Ctrl+C in the terminal, Scripts panel and npm.cmd in the Run tab, clone_repository, search,
  menu shortcuts (47 Ctrl, no Cmd) all pass. Windows PowerShell 5.1 splits JSON arguments with spaces.
- `--args-file <file>` and `--args-file -` for `cli call`, so JSON never passes through the shell.
- Windows screenshot: `PrintWindow` with `PW_RENDERFULLCONTENT`, cropped to the DWM frame,
  PNG from `png_encode.rs` (flate2). Check on the PC with `git-manager cli screenshot`.
- Memory readout on Windows: `memory.rs` walks the app's WebView2 processes and counts each
  private working set (Task Manager's Memory), labels from `--type=`; the status bar hides Clear Cache outside
  macOS and names Task Manager and WebView2 in its popup. Check on the PC with `get_memory_usage`.
- Checked on the PC with the `6cb3403` installer: the memory readout matches Windows' private working set counter
  for all 7 processes to 0.1 MB (6 WebView2 helpers of the app, none of the other 12 on the PC); the screenshot
  is the whole window at 1402x872; `--args-file` works from stdin and a file in Windows PowerShell 5.1.
  Clippy on Windows wanted `as_chunks::<4>()` in the screenshot's pixel loop (fixed).
- Found in the screenshot: about 40 UI texts write shortcuts the macOS way (`Shift+Cmd+G`, `Cmd+P`, `Option+Cmd+B`)
  on Windows too: the empty editor area, tooltips, panel buttons and Settings hints.
- Shortcut labels: `formatKeyWords`, `commandKeys`, `withCommandKeys` and `localKeys` replace every
  typed shortcut in the UI (empty editor area, activity bars, panel buttons, Search Everywhere tabs, merge tool,
  commit box, find bar, Markdown toolbar, Settings hints); the terminal hint has its own Windows wording.
- Checked on the PC (2888344): the shortcut labels say Ctrl (empty editor area, every tooltip on screen, no "Cmd").
  No console window during 12 git operations through the app, fetch and a network clone included: a window
  watcher in the desktop session polled 2792 times in 45 s and caught nothing, and caught a deliberate `cmd`
  window at once. Cancel through UI Automation: 5 git processes (git-remote-https included) while cloning Linux,
  none 4 s after Cancel, and the half-cloned folder removed.
- Small finding: the Clone dialog's folder field is named "Clone into folder Browse..." for screen readers,
  because its label also holds the Browse button.
