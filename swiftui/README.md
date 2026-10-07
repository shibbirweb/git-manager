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
App/Sources/     SwiftUI app (Backend.swift calls the bridge, Control.swift answers the control server)
  Generated/     Themes.swift, written by gm-measure tokens
Reference/       layout snapshots of the current app (gm-measure reference)
App/Bridge/      module map and C header for the bridge
bridge/          Rust static library: gm_call(command, argsJson) -> JSON, gm_free_string
Tools/           gm-measure: Measure/ (commands), MeasureKit/ (library), Tests/
scripts/         build-app.sh, test.sh
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

## Measure both apps (gm-measure)

`Tools/` holds `gm-measure`, a Swift command that drives and measures both apps from the outside through their
MCP servers. Each app starts isolated: macOS launches it with HOME set to a throwaway folder, so the real
`~/.gitmanager` is never touched.

```sh
cd swiftui
swift run -c release gm-measure measure --duration 20   # both apps on the docs demo: memory, start time, screenshots
swift run -c release gm-measure diff a.png b.png --out diff.png   # identical pixels and a red overlay
swift run -c release gm-measure smoke                   # checks every control tool of the built native app
swift run -c release gm-measure tokens                  # writes App/Sources/Generated/Themes.swift (--check: is it up to date)
swift run -c release gm-measure reference               # what to match: Reference/*.json and build/reference/*.png
```

- `tokens` runs the theme catalog (`src/lib/themes/catalog.ts`) with Bun and writes every theme's 73 color tokens
  to `Generated/Themes.swift`, so SwiftUI colors are never typed by hand. Run it after any theme change; CI fails
  when the file is out of date.
- `reference` starts the current app isolated, in light and dark, on the Changes screen and the diff of
  `src/cart.ts`. For each it writes a layout snapshot to `Reference/<screen>-<mode>.json` (every visible
  element of the header, activity bars, status bar, changes list, commit box and diff, with its box and
  computed styles, read with the app's `inspect_elements` tool) and a screenshot to
  `build/reference/<screen>-<mode>.png` (captured by gm-measure, like `measure` does). Snapshots are committed, so a change to the current UI shows up in
  review; regenerate them on purpose (the status bar's memory text differs on every run).

`measure` compares the installed `/Applications/Git Manager.app` (or `--current-app <path>`) with the native
build (`--native-app <path>`) and writes `build/measure/<time>/report.md`, `report.json`, both screenshots and
`diff.png`. gm-measure captures both windows itself, the same way, so the pixel diff compares like with like;
that needs Screen Recording permission for the app that runs it (your terminal), once, then a restart of it.

## Checks

```sh
cd swiftui/bridge && cargo clippy --locked --lib --examples --tests -- -D warnings
cd swiftui/bridge && cargo test --locked          # gm_call and the control server, over real repositories
swiftui/scripts/build-app.sh
swiftui/scripts/test.sh                           # Swift tests (pixel diff, PNG, launcher)
cd swiftui && swift run -c release gm-measure smoke
```

CI runs the same steps on pull requests that touch `swiftui/` or the backend files the bridge shares
(`.github/workflows/native.yml`), and attaches the zipped app to the run. The shared modules' own unit tests run
in `src-tauri` (`cargo test --workspace`); the bridge does not build them (`test = false`), because they need
src-tauri's test helpers.

## Status

| Phase | State |
|---|---|
| 0 Skeleton: window, bridge, one command (`get_status`) | built, UI checked |
| 0b Control server: CLI and MCP drive and measure the app | built, waiting for the check |
| 1a Measuring tools: gm-measure (measure, diff, smoke) and CI | done |
| 1b Tokens and layout snapshots (gm-measure tokens, reference) | built, waiting for the check |
| 2 Design foundation | not started |
| 3 First slice | not started |
