# Git Manager Native (SwiftUI experiment)

A second macOS app whose UI is written in SwiftUI, on the same Rust backend as Git Manager. It lives here,
beside the current app, so we can measure both (memory, speed, look) before deciding anything. The plan,
phases and rules are in [docs/plans/swiftui-experiment.md](../docs/plans/swiftui-experiment.md).

Nothing here is part of the current app's build: `src/`, `src-tauri/`, CI and releases ignore this folder.

## Build and run

Needs Rust and Swift 5.9 or later (the Command Line Tools are enough; Xcode is optional).

```sh
swiftui/scripts/build-app.sh            # release build: swiftui/build/Git Manager Native.app
swiftui/scripts/build-app.sh debug      # debug Swift build (the bridge is always release)
open "swiftui/build/Git Manager Native.app" --args -folder /path/to/repo   # opens that folder at start
```

The app's bundle id is `shibbirweb.github.io.gitmanager.native`, so it installs next to Git Manager
(`com.shibbir.gitmanager`) without touching it.

## How it fits together

```
App/Sources/     SwiftUI app (Backend.swift calls the bridge, Status.swift mirrors the DTOs)
App/Bridge/      module map and C header for the bridge
bridge/          Rust static library: gm_call(command, argsJson) -> JSON, gm_free_string
scripts/         build-app.sh
```

- **One entry point.** `gm_call` takes a command name and camelCase JSON arguments, like `invoke` in
  `src/lib/api.ts`, and returns `{"ok":true,"value":...}` or `{"ok":false,"error":{"kind","message"}}`.
  The commands live in `bridge/src/commands.rs`, named and shaped like the Tauri ones, so `api.ts` and
  `types.ts` stay the reference for both apps.
- **Shared backend, unchanged.** `bridge/src/lib.rs` includes `src-tauri/src/git`, `merge`, `error`, `paths`,
  `askpass`, `git_console` and `child_process` by path. They do not use Tauri, so the same git code runs in
  both apps and `src-tauri/` does not change. If one of them starts using Tauri, the bridge build fails.
- **Own Cargo workspace.** `bridge/Cargo.toml` declares `[workspace]`, so `cargo test --workspace` in
  `src-tauri` never builds it.

## Control and measure (CLI and MCP)

The app runs a small MCP server (`bridge/src/control.rs`, UI side in `App/Sources/Control.swift`), so the
same `git-manager cli` drives and measures both apps. It writes `~/.gitmanager-native/.gitmanager/mcp.json`,
never the real app's file, and the CLI finds it when `HOME` points at `~/.gitmanager-native`:

```sh
N=~/.gitmanager-native
HOME=$N git-manager cli status                     # is the native app running
HOME=$N git-manager cli memory --duration 10       # live memory, same counting as the current app
HOME=$N git-manager cli screenshot shot.png        # the window, even when covered
HOME=$N git-manager cli call app action=get_state  # open folder, branch, files, window size
HOME=$N git-manager cli call app action=open_folder folderPath=/path/to/repo
git-manager cli memory --duration 10               # the same measurement on the current app
```

| Tool | Same as the current app |
|---|---|
| `get_memory_usage`, `sample_memory` | yes: names, arguments, result shape and counting method |
| `take_screenshot` | yes: the window without its shadow; captured in-app, so no Screen Recording permission |
| `git_status` | yes |
| `get_app_info` | native fields (name, version, pid, bundle id) |
| `app` | native only for now: `get_state`, `open_folder` |

## Checks

```sh
cd swiftui/bridge && cargo clippy --lib --examples -- -D warnings
cd swiftui/bridge && cargo run --example call -- get_status '{"repoPath":"/path/to/repo"}'
cd swiftui && swift build
```

The shared modules' own unit tests run in `src-tauri` (`cargo test --workspace`); the bridge does not build
them (`test = false`), because they need src-tauri's test helpers.

## Status

| Phase | State |
|---|---|
| 0 Skeleton: window, bridge, one command (`get_status`) | built, UI checked |
| 0b Control server: CLI and MCP drive and measure the app | built, waiting for the check |
| 1 Measuring tools | not started |
| 2 Design foundation | not started |
| 3 First slice | not started |
