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
Sources/GitManagerNative/   the SwiftUI app
  App/                     app entry, window model, layout (Shell.swift) and title bar
  Models/                  mirrors of the backend's types (Status.swift) and view state (FilesModel.swift)
  Services/                Backend.swift calls the bridge, Control.swift answers the control server, highlighting
  Theme/                   theme tokens as colors, and CSS color math as WebKit does it
  Views/<screen>/          Chrome, Changes, Files, Diff, Welcome; shared pieces in Components
  Generated/               Themes and Icons, written by gm-measure tokens and icons
Sources/NativeCore/        pure, tested logic (diff rows, folds, ruler ticks, row index, character diff)
Sources/GMBridge/          module map and C header for the bridge
Sources/GMMeasure/         gm-measure commands; Sources/MeasureKit/ is its library
Tests/                     NativeCoreTests/ and MeasureKitTests/ (Swift Testing)
Highlight/entry.ts         the current app's highlighters, bundled into the app's highlight.js
Reference/                 layout snapshots of the current app (gm-measure reference)
Parity/                    the parity list: every feature of the current app, its scenario and native status
bridge/                    Rust static library: gm_call(command, argsJson) -> JSON, gm_free_string
scripts/                   build-app.sh, test.sh, check-lines.sh, ci-allow-screen-capture.sh (CI only)
```

- **One entry point.** `gm_call` takes a command name and camelCase JSON arguments, like `invoke` in
  `src/lib/api.ts`, and returns `{"ok":true,"value":...}` or `{"ok":false,"error":{"kind","message"}}`.
  The commands live in `bridge/src/commands/` (the writes, stage, unstage, commit and the commit toast's Undo, in
  `write.rs`), named and shaped like the Tauri ones, so `api.ts` and `types.ts` stay the reference for both apps.
  Writes go through the shared git CLI code (`git/cli.rs`), as in the current app.
- **Shared backend, unchanged.** `bridge/src/lib.rs` includes `src-tauri/src/git`, `merge`, `error`, `paths`,
  `askpass`, `git_console`, `child_process`, `terminal` and `terminal_flow` (the integrated terminal's pseudo
  terminals, output merging and flow control) by path. They do not use Tauri, so the same git code runs in
  both apps and `src-tauri/` does not change. If one of them starts using Tauri, the bridge build fails.
- **Own Cargo workspace.** `bridge/Cargo.toml` declares `[workspace]`, so `cargo test --workspace` in
  `src-tauri` never builds it.

## Control and measure (CLI and MCP)

The app runs a small MCP server (`bridge/src/control/`, UI side in
`Sources/GitManagerNative/Services/Control.swift`), so the same `git-manager cli` drives and measures both apps.
It writes `~/.gitmanager-native/.gitmanager/mcp.json`, never the real app's file, and the CLI finds it when
`HOME` points at `~/.gitmanager-native`:

```sh
N=~/.gitmanager-native
HOME=$N git-manager cli status                     # is the native app running
HOME=$N git-manager cli memory --duration 10       # live memory, same counting as the current app
HOME=$N git-manager cli screenshot shot.png        # the window, even when covered
HOME=$N git-manager cli call app action=get_state  # open folder, branch, files, window size
HOME=$N git-manager cli call app action=open_folder folderPath=/path/to/repo
HOME=$N git-manager cli call app action=stage --args '{"filePaths":["src/cart.ts"]}'   # like the row's Stage
HOME=$N git-manager cli call app action=commit message="Fix the cart"                  # types, then Commit
git-manager cli memory --duration 10               # the same measurement on the current app
```

| Tool | Same as the current app |
|---|---|
| `get_memory_usage`, `sample_memory` | yes: names, arguments, result shape and counting method |
| `take_screenshot` | yes: the window without its shadow; captured in-app, so no Screen Recording permission |
| `git_status` | yes |
| `get_app_info` | native fields (name, version, pid, bundle id) |
| `app` | native only, with the actions below |
| `open_settings`, `close_dialog` | yes: names and the `section` argument (Settings only) |
| `app` (terminal) | `show_panel`, `list_terminals`, `new_terminal`, `send_terminal_text`; `terminal_text` native only |

The `app` actions: `get_state`, `open_folder`, `show_diff`, `diff`, `open_file`, `show_log`, `scroll`, `stage`,
`unstage` and `commit`. `diff` moves to the next or previous change, opens fold steps and toggles Collapse unchanged.
`open_file` opens `filePath` (relative to the folder, or absolute) in a kept tab, like a double click in the Files
panel (`preview` true: the preview tab), and answers once the text, its colors and its blame note are on screen;
`get_state` lists the tabs and the shown file under `editor`. `show_log` shows the Log like the History activity
(`visible` false hides it), selects the commit at `position` in the list or a revision (`commitId`, such as HEAD~5),
and answers once the history, the commit's details and its first file's diff are shown.

`stage` and `unstage` take `filePaths` (without them, the whole group, like Stage all and Unstage all); `commit`
takes `message` and `amend`. They run through the window like a click, so the busy state, the toasts and the status
refresh happen as for a user, and they answer with `get_state` once the refresh is done (the Staged and Changes
groups, the commit box, the toasts on screen). The current app's own `git_stage` and `git_commit` tools write
without its window, which then follows from its file watcher.

The server listens on a port macOS picks (port 0), so two native builds (from two worktrees, say) never fight over
one; each writes its port to the `mcp.json` under its own HOME. gm-measure starts every app with a throwaway HOME, so
runs side by side stay apart. Started by hand with the same HOME, the last app to start owns that `mcp.json`.

## Measure both apps (gm-measure)

`Sources/GMMeasure` holds `gm-measure`, a Swift command that drives and measures both apps from the outside
through their MCP servers. Each app starts isolated: macOS launches it with HOME set to a throwaway folder, so the real
`~/.gitmanager` is never touched.

```sh
cd swiftui
swift run -c release gm-measure measure --duration 20   # both apps on the docs demo: memory, start time, screenshots
swift run -c release gm-measure measure --screen diff  # the same on the diff of src/cart.ts
swift run -c release gm-measure measure --screen diff --collapse off   # every line, the first change centered
swift run -c release gm-measure measure --screen diff --walk 37        # scroll down and back before the shot
swift run -c release gm-measure measure --screen staged  # the Changes screen after staging src/cart.ts
swift run -c release gm-measure measure --screen file    # src/catalog.ts in a file tab
swift run -c release gm-measure measure --screen log     # the Log, the newest commit and its diff selected
swift run -c release gm-measure measure --screen settings  # Settings open on Appearance (open_settings)
swift run -c release gm-measure measure --mode dark --theme monokai-charcoal  # a color theme in both apps
swift run -c release gm-measure memory                  # a 4000-line PHP diff: idle, open, scrolling, after
swift run -c release gm-measure memory --screen file    # the same file open in a tab instead of its diff
swift run -c release gm-measure memory --screen log     # 3000 commits in the Log: idle, open, scrolling, after
swift run -c release gm-measure measure --screen terminal  # the terminal panel, a shell with fixed output
swift run -c release gm-measure memory --scenario terminal  # terminal: idle, open, printing 4000 lines, after
swift run -c release gm-measure diff a.png b.png --out diff.png   # identical pixels and a red overlay
swift run -c release gm-measure smoke                   # checks every control tool of the built native app
swift run -c release gm-measure tokens                  # writes the app's Generated/ (--check: up to date?)
swift run -c release gm-measure icons                   # writes Generated/Icons*.swift from src/lib/ui/icons.ts
swift run -c release gm-measure reference               # what to match: Reference/ and build/reference/
swift run -c release gm-measure reference --screens log # only some screens (changes, log, diff)
swift run -c release gm-measure parity                  # UI match per scenario, light and dark (see below)
swift run -c release gm-measure display                 # HDR headroom, screen and color space; exit 1 with HDR on
```

- `tokens` runs the theme catalog (`src/lib/themes/catalog.ts`) with Bun and writes every theme's 73 color tokens
  to `Generated/Themes/<id>.swift` (one small file per theme) and the list to `Generated/Themes.swift`, so SwiftUI
  colors are never typed by hand. Run it after any theme change; CI fails when the files are out of date.
- `reference` starts the current app isolated, in light and dark, on the Changes screen and the diff of
  `src/cart.ts`. For each it writes a layout snapshot to `Reference/<screen>-<mode>/<part>.json` (every visible
  element of the layout, header, activity bars, status bar, Files panel, changes list, commit box and diff, with
  its box and computed styles, read with the app's `inspect_elements` tool; a part longer than 300 lines
  continues in `<part>-2.json`) and a screenshot to `build/reference/<screen>-<mode>.png` (captured by
  gm-measure, like `measure` does). Snapshots are committed, so a change to the current UI shows up in review;
  regenerate them on purpose (the status bar's memory text differs on every run).

`measure` compares the current app (or `--current-app <path>`) with the native build. The current app is the local
build in `src-tauri/target/release/bundle/macos` when there is one (latest develop plus unreleased fixes, built
with `bun tauri build --bundles app`), else the installed `/Applications/Git Manager.app`. The native app is the
build (`--native-app <path>`) and writes `build/measure/<time>/report.md`, `report.json`, both screenshots and
`diff.png`. gm-measure captures both windows itself, the same way, through ScreenCaptureKit, so the pixel diff
compares like with like; that needs Screen Recording permission for the app that runs it (your terminal), once,
then a restart of it. ScreenCaptureKit gives the pixels the display shows; CGWindowListCreateImage, used before,
composited the window again and landed one step off on some surfaces in some calls (MeasureKit/LiveWindowCapture).
The report gives the whole window and the content below the title bar, which macOS draws in both apps. The current
app keeps "Collapse unchanged" in WebKit localStorage under the real `~/Library` (shared with your own Git
Manager), so `measure` and `reference` set it for the run (`measure --collapse on|off`, on by default) and put
your value back; they wait for, and then refuse to run beside, a running Git Manager. The native app keeps the
same choice in `~/.gitmanager-native/diff.json` (`{"collapseUnchanged":true}`), which `measure` writes in the
run's throwaway HOME. `--walk <points>` scrolls both apps down and back (each ends where it started) before the
screenshot, to check that scrolling leaves the same pixels. `memory` reports each app's frame times during its
scroll walk, and for the native app how long the diff canvas took to paint.

**HDR state.** The current app (WebKit) renders some dark colors one step differently while the display has HDR
headroom, which macOS gives it whenever any app shows HDR content (a video, an HDR photo). So `measure`, `memory`,
`reference` and `parity` check the main screen before the run and before each capture (each memory phase): with
`--hdr off`, the default, the headroom must be 1.0. A capture waits up to `--hdr-wait <s>` (30) for it, then the
command stops and names the cause; close or hide the HDR content and run again. `--hdr any` skips the check. Every
report gives the state at the captures (`Display: HDR off at every capture (headroom 1, potential 16), Built-in
Retina Display, color space Color LCD, brightness not readable. Required: --hdr off.`) and report.json the same as
`display` (each capture's headroom). Brightness comes only from public APIs (IOKit), which Apple silicon's built-in
display does not answer. NSScreen updates these values only on a run loop, so gm-measure reads them from a new
`gm-measure display --json` process each time. `reference` writes its line to `build/reference/report.md`.

## Parity list and UI match per scenario (gm-measure parity)

[Parity/README.md](Parity/README.md) lists every feature of the current app (all of `docs/wiki/features.json`, plus
the window shell) with its scenario, the native status (done, partial, missing), the last pixel match and memory;
[Parity/Scenarios.md](Parity/Scenarios.md) gives each scenario's steps and what each feature still lacks. Both are
generated: edit the JSON (`features-*.json`, `scenarios-*.json`) and run `gm-measure parity summary`. A test fails
when a wiki feature is missing from the list or the pages are stale.

```sh
cd swiftui
swift run -c release gm-measure parity                      # every scenario the native app can show, light and dark
swift run -c release gm-measure parity --scenarios diff --modes dark --current-app /path/to/Git\ Manager.app
swift run -c release gm-measure parity --record             # also keep the numbers in Parity/results.json
swift run -c release gm-measure parity list                 # the scenarios, and which ones run
swift run -c release gm-measure parity summary [--check]    # write (or check) Parity/README.md and Scenarios*.md
```

Each scenario runs in both apps like `measure` does (isolated launches, gm-measure's own window capture, settle 3 s,
memory sampled 5 s; `--settle`, `--sample` change that) and writes `build/parity/<time>/report.md`, `report.json`
and per scenario and mode both screenshots and `diff.png` (the overlay below the title bar). The report lists, per
scenario, the features missing or partial in native, and the scenarios the native app cannot show yet. A launch,
step or capture that fails is written next to its scenario, and the exit code is then 1.

The native app keeps its settings in `~/.gitmanager-native/settings.json`, with the current app's keys and
validation; `measure --theme` writes the color theme there and in the current app's settings.json.

A scenario runs in both apps once it has a `run` spec: files to stage in both apps first (`stageFiles`, unstaged
again after the capture, since the scenarios share one demo), the file whose diff to open (`showDiff`, `staged`),
"Collapse unchanged" in both apps (`collapseUnchanged`, set and checked on screen as `measure --collapse` does),
localStorage values and settings for the current app (`currentStorage`, `currentSettings`), settings.json values
for both apps (`appSettings`), the Settings section to open in both (`openSettings`), launch arguments for
the native app (`nativeArguments`) and elements the current app must show before the capture (`expectCurrent`).
A new screen of the native app usually needs only a `run` spec in its scenario. `staged` (Changes after staging
src/cart.ts) and `diff-every-line` (collapse off) are the parity side of `measure --screen staged` and
`--collapse off`. A display with HDR on stops the run (`--hdr`, as above); the report keeps what ran.

`.github/workflows/native-parity.yml` runs it on pull requests that touch `swiftui/` and by hand (scenarios, modes
and the release to compare with are inputs). It builds the native app, downloads the current app from the newest
beta release (`Git.Manager_universal.app.tar.gz`, else the `.dmg`; built from the commit when no release has one),
grants Screen Recording with `scripts/ci-allow-screen-capture.sh` (TCC entries for the runner's process chain;
the runner images keep SIP off, which allows that), fails at once if the runner's display reports HDR headroom
(`gm-measure display --hdr off`), runs with `--hdr off`, posts the report as the job summary and uploads
`build/parity/`. The workflow has not run on GitHub yet, so the permission step is untried there.

## Checks

```sh
swiftui/scripts/check-lines.sh                    # every file at most 120 columns and 300 lines
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
| 2a Window shell: layout, theme colors, title bar | done |
| 2b Edges: icons, header, activity bars, status bar | done |
| 2c Changes list and commit box | done |
| 2d Files panel tree | done |
| 2e Welcome screen, exact color conversion | done |
| 2f Matching to 99% (font smoothing, blends, alignment) | done |
| 3a Diff screen: tab, toolbar, panes drawn per viewport, folds, ruler (97%) | done |
| 3b Diff screen to 99%: syntax colors, brackets, guides, changed words, text blending | done |
| 1c Parity list and UI match per scenario (gm-measure parity, native-parity.yml) | built, CI run not yet tried |
| GM-45 Diff interactions (collapse, fold steps, previous and next change), smooth scrolling | done |
| 3c Stage, unstage and commit through the bridge: hover buttons, busy state, toasts, Amend, Undo | done |
| GM-51 HDR gate in gm-measure (`--hdr`), parity list and run specs for 3c and GM-45 | done |
| GM-52 File tabs and the read-only file view: open from the Files panel, file bar, editor canvas, status items | done |
| GM-53 Log and history: graph, refs, commit details and its read-only diff, `show_log`, `--screen log` | done |
| GM-56 Settings dialog, settings.json, live color themes (`--screen settings`, `--theme`) | done |
| GM-55 Terminal panel: the current app's PTY through the bridge, an xterm.js-like emulator, its WebGL canvas | built |
