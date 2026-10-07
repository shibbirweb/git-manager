# SwiftUI experiment: a second Mac app with a native UI

Goal: build a second macOS app whose UI is written in SwiftUI, looks pixel for pixel like the current app,
and uses the same Rust backend. Then measure both apps side by side (memory, speed, look) and decide.

The current app does not change. `src/`, `src-tauri/`, the Windows and Linux builds, CI and releases stay
exactly as they are. All new work lives in a new top-level `swiftui/` folder.

## Ground rules

- **Nothing outside `swiftui/` changes** for this experiment, except this plan and its row in
  [README.md](README.md). If a later phase really needs a change in `src-tauri/` (for example a shared
  `core` crate), it gets its own ticket and the user decides first.
- **Separate builds.** `swiftui/` has its own Cargo workspace and its own Swift package, so
  `cargo test --workspace`, clippy, `bun run check`, `bun run test` and every CI job keep ignoring it.
- **Two apps side by side.** The SwiftUI app is called "Git Manager Native" with its own bundle id
  (`shibbirweb.github.io.gitmanager.native`) and its own settings folder (`~/.gitmanager-native/`), so it
  never overwrites the real app's `settings.json` or `state.json`.
- **Not user-visible yet.** No CHANGELOG lines, no What's New, no wiki pages, no release workflow until the
  user decides to ship it. Progress is tracked in this file and in `swiftui/README.md`.
- **Same conventions.** GM tickets, `feat:[GM-N]` / `fix:[GM-N]` commits, one branch per phase from
  `develop`, PRs into `develop`. Org code style applies to Swift too (braces on every `if`, domain names for
  parameters, no em-dash).

## Can SwiftUI match the current UI pixel for pixel?

Mostly yes, if we draw our own controls instead of using the stock ones. What helps:

- On macOS, one CSS pixel is one point, so every size in `app.css` and the components (13px text, 6px
  radius, 6px panel gap, 10px panel radius, paddings) carries over as the same number of points.
- WebKit draws text with Core Text, the same engine Swift can call. With the same font (SF Pro for
  `-apple-system`, JetBrains Mono for code), size, weight, antialiasing and position, glyphs come out the same.
- Colors are exact hex values from our tokens, so they can be generated, not copied by hand.

What makes it hard, and how we handle it:

| Area | Problem | Plan |
|---|---|---|
| Text layout | SwiftUI `Text` picks its own line height, baseline and kerning | Draw text with Core Text (`CTLine`) in custom views with CSS's line-height rules; use SwiftUI `Text` only where a test shows it matches |
| Controls | Stock buttons, fields, lists, scrollbars and focus rings look like AppKit | Custom-drawn components (button, input, checkbox, select, list row, tree, tabs, split handle, overlay scrollbar, tooltip, menu, dialog, toast) |
| Code editor | No CodeMirror in Swift | Custom editor on TextKit 2 (or STTextView), with tree-sitter for syntax and our `tok-*` colors; built in its own phase |
| Terminal | No xterm.js | SwiftTerm, themed with our `--term-*` tokens |
| Icons | `src/lib/ui/icons.ts` holds 76 SVG icons, plus file icon sets | Generate Swift `Path` code (or PDF assets) from the same SVG data with a script |

**Target we can test:** layout boxes equal to the pixel, colors exact, and at least 99.5 percent of pixels
identical on every reference screen. Text edges may still differ by a pixel or two of antialiasing; the diff
report shows every place that does, and we fix each one we can. A zero-difference screen is the stretch goal,
not the promise.

## Tools we build first

All of them are one Swift command, `gm-measure` (`swiftui/Tools/`), so `swiftui/` stays Swift and Rust. It
drives both apps through their MCP servers (the native one from phase 0b, the current one with its server
turned on in a throwaway home), so it measures the real windows, not a browser copy.

1. **Isolated launches.** Each app starts from macOS (`open -n`) with HOME pointing at a fresh folder, so its
   settings and server file never touch the real `~/.gitmanager`, and macOS counts its memory exactly. The
   current app gets a free MCP port, because the real app usually holds its default (48731).
2. **Memory scenario** (`gm-measure measure`): both apps, one after the other, do the same steps on a fresh
   copy of the docs demo (`scripts/make-docs-demo.sh`): open `acme/storefront`, wait until its status is on
   screen, settle, screenshot, sample memory. The steps grow (open 10 files, scroll a long file, show a diff)
   as the native app learns them, for both apps at once. Memory counts every process the app is responsible
   for, the same way `src-tauri/src/memory.rs` does (for the current app that includes WebKit's web content
   and GPU processes). Reports go to `swiftui/build/measure/<time>/`.
3. **Pixel diff** (`gm-measure diff`): compares two PNGs, prints the share of identical pixels and the box
   around the differences, and writes a red-overlay image. gm-measure captures both apps' windows itself
   (`MeasureKit/WindowCapture.swift`): the window as the window server draws it, without its shadow, with the
   same code for both. That needs Screen Recording permission once for the app that runs gm-measure (the
   terminal). The current app's own take_screenshot is refused even with permission (most likely its ad-hoc
   release signing on recent macOS), which also affects users: a separate follow-up.
4. **Smoke test** (`gm-measure smoke`): starts the built native app on a small test repository and checks
   every control tool. CI runs it on every pull request that touches the native app
   (`.github/workflows/native.yml`).
5. **Token export** (`gm-measure tokens`, part 1b): runs the theme catalog with Bun (it is TypeScript; the
   tool runs Bun the way it runs git and open) and writes `swiftui/App/Sources/Generated/Themes.swift`: 42
   themes, 73 tokens each. CI fails when it is out of date, and runs when `src/lib/themes` changes.
6. **Layout snapshots** (`gm-measure reference`, part 1b): the current app, isolated, light and dark, on the
   Changes screen and a diff. Every visible element of each part (header, activity bars, status bar, changes
   list, commit box, diff) with its box and 30 computed styles, read with the app's `inspect_elements` tool,
   so `src/` needs no change. Committed as `swiftui/Reference/<screen>-<mode>.json`; screenshots (captured by
   gm-measure) go to `swiftui/build/reference/`.

## Folder layout

```
swiftui/
  README.md            how to build, run and test
  Package.swift        Swift package: the app, gm-measure and its tests
  App/Sources/         SwiftUI app
    Generated/         Themes.swift, Icons.swift (from the tools, not edited by hand)
  bridge/              Rust crate with its own Cargo workspace
    Cargo.toml
    src/lib.rs         gm_call and gm_free_string over the shared backend modules
  Tools/               gm-measure (Measure/), its library (MeasureKit/) and tests (Tests/)
  scripts/build-app.sh builds the Rust bridge, the Swift package, and the .app bundle
  scripts/test.sh      runs the Swift tests (finds Swift Testing with the Command Line Tools too)
```

**Toolchain:** this Mac has the Command Line Tools (Swift 6.3) but not full Xcode. A Swift package builds
SwiftUI apps with that, and `build-app.sh` writes the `.app` bundle and `Info.plist` itself. Installing
Xcode later gives SwiftUI previews and Instruments, which help but are not required.

## How Swift reaches the Rust backend

The modules Swift needs do not use Tauri: `git/`, `merge/`, `text_search`, `file_search`, `symbols`,
`askpass`, `paths`, `error`, `child_process`. Tauri appears only in `commands/` (41 files, about 209
commands), `lib.rs`, `watcher.rs`, `memory.rs`, `windows.rs`, `mcp/`, `github/commands.rs` and
`preview_scheme`.

- **Phase 0 to 2:** `swiftui/bridge` includes the needed modules straight from `src-tauri/src/` with
  `#[path = "..."]` (`git`, `merge`, `error`, `paths`, `askpass`, `git_console`, `child_process`). No file in
  `src-tauri/` changes. One C function, `gm_call(command, argsJson)`, returns JSON like the page's `invoke`,
  so the Swift side needs no generated bindings for 209 commands; the crate builds as a static library linked
  into the app. (Built in phase 0 instead of UniFFI: simpler, and it keeps `api.ts` as the reference.)
- **After the decision:** if SwiftUI wins, move those modules into a shared `core` crate that both apps
  depend on. That is the one step that changes `src-tauri/`, so it waits for the user's go-ahead.
- Writes still go through the git CLI and reads through git2, exactly as now, because the same code runs.

## Phases

Each phase is one branch and one PR. A phase is done when its checks pass and its numbers are written here.

### Phase 0: skeleton

- `swiftui/` folder, Swift package, bridge crate, `build-app.sh`.
- An empty "Git Manager Native" window, 1400 x 880, standard title bar like the current app.
- One bridge call end to end (for example the repository status of a folder), shown as plain text.
- Done when: `build-app.sh` produces a running app, and the current app's checks are untouched.

### Phase 0b: control server

- A small MCP server in the bridge (`swiftui/bridge/src/control.rs`) with the current app's tool names and
  result shapes for `get_memory_usage`, `sample_memory`, `take_screenshot` and `git_status`, plus an `app` tool
  that drives the window. It writes `~/.gitmanager-native/.gitmanager/mcp.json`, so
  `HOME=~/.gitmanager-native git-manager cli ...` reaches the native app and plain `git-manager cli` the
  current one, with no change to `src-tauri/cli`.
- The screenshot is taken in-app (an app may capture its own windows), so the native app needs no Screen
  Recording permission and no signing identity.
- Done when: the same CLI commands measure both apps.

### Phase 1: measuring tools

- Part 1a: isolated launches, memory scenario, pixel diff, smoke test, and CI for the native app
  (`.github/workflows/native.yml`: bridge clippy and tests, app build, Swift tests, smoke test, the zipped
  app as a download on the pull request).
- Part 1b: token export, layout snapshot, reference screenshots of the slice-1 screens, light and dark.
- Done when: the tools run against the current app and produce reference data.

### Phase 2: design foundation

- Generated themes and icons; fonts (SF Pro for UI at 13pt, JetBrains Mono for code with Menlo fallback).
- Core Text label view with CSS line-height and baseline rules, checked against the layout snapshot.
- Custom components: button, icon button, input, checkbox, select, list row, tree row, tabs, split panes
  with resize handle, overlay scrollbar, tooltip, context menu, dialog, toast, panel header.
- A component gallery window that shows each one next to its reference crop, with the pixel diff score.
- Done when: every component reaches the target in light and dark.

### Phase 3: first slice

Open folder, Changes list, diff of a file, commit:

- Header, activity bar, sidebar with the Changes view (groups, file rows, status letters, counts), status bar.
- Diff view (side by side and inline) on the custom text view, read-only for now.
- Commit box and commit through the bridge (git CLI), with the same busy state and error toasts.
- Done when: the slice works on the demo repo, every slice screen reaches the pixel target, and the memory
  scenario has numbers for both apps.

### Decision point

Write the results here: memory (idle, after the scenario, peak while scrolling), launch time, time to show a
diff, app size, pixel scores, and how long phases 0 to 3 took. The user decides: stop, continue, or plan the
switch.

### Later phases (only after the decision)

In order, each with the same pixel and memory checks: Files panel and file tabs; code editor (editing,
completion, multiple cursors, folding, minimap, sticky scroll); Log and history; blame; merge tool (logic
checked against `src/lib/merge/model.ts` tests and the Rust engine); terminal (SwiftTerm); Settings and theme
switching; search and quick open; workspaces and windows; welcome screen; GitHub and MCP; updates.

## Keeping the two apps in step

- Themes and icons always come from the generators, never hand edits.
- When a UI change lands in `src/`, retake the affected reference screenshots and the pixel diff shows what the
  SwiftUI app now needs. A small table in `swiftui/README.md` lists each screen, its last reference date and
  its score.
- Logic that is pure TypeScript today (for example `merge/model.ts`, `editor/lineDiff.ts`) is either ported
  with its tests or moved into the Rust bridge, so both apps share one version where possible.

## Risks

- **Double work.** Every new feature would need building twice while both apps exist. That is why there is a
  decision point after the first slice.
- **The editor** is the biggest single piece. Matching CodeMirror's look and behavior on TextKit 2 may take as
  long as everything else in the slice.
- **Text edges** may never be 100 percent identical; the target allows for that and the diff shows where.
- **Reusing modules by path** is fragile if those modules start using Tauri. The bridge build fails loudly when
  that happens, and the shared `core` crate is the long-term fix.

## Status

| Phase | Branch | State | Notes |
|---|---|---|---|
| 0 Skeleton | feat/GM-31-swiftui-skeleton | UI checked | 1.5 MB app; get_status through the bridge |
| 0b Control server | feat/GM-31-swiftui-skeleton | built, waiting for the check | 22 MB idle vs 350 MB for the current app (not yet a fair scenario) |
| 1a Measuring tools | feat/GM-31-swiftui-skeleton | done (88d2b00) | Demo storefront, 20 s: current app 142 MB average (188 peak), native 24 MB (26 peak); status on screen 1.7 s vs 1.0 s |
| 1b Tokens and layout | feat/GM-31-swiftui-skeleton | built, waiting for the check | Themes.swift 42 themes; snapshots and screenshots of changes and diff, light and dark (window content 1400 x 848); first pixel diff 0.03% identical (native is plain text); memory 142 MB vs 24 MB |
| 2 Design foundation | | not started | |
| 3 First slice | | not started | |
