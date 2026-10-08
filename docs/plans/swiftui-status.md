# SwiftUI experiment: status notes

What each phase of [the SwiftUI experiment](swiftui-experiment.md) built, what measuring both apps showed, and
the numbers. Newest last.


- 0: the app is 1.5 MB; get_status goes through the bridge.
- 0b: 22 MB idle against 350 MB for the current app (not yet a fair scenario).
- 1a: demo storefront, 20 s: current app 142 MB average (188 peak), native 24 MB (26 peak); status on screen
  1.7 s against 1.0 s.
- 1b: 42 generated themes; snapshots and screenshots of the Changes and diff screens, light and dark (window
  content 1400 x 848); first pixel diff 0.03% identical, as the native window was still plain text.
- Line standard (2026-10-07): every file at most 120 columns and 300 lines, generated data included;
  `swiftui/scripts/check-lines.sh` checks it in CI.
- 2a window shell: the native window has the current app's layout (header 42, activity bars 44, sidebars 260,
  1-point gaps, main area with its 28-point breadcrumb strip and line, status bar 24) and colors, and its title
  bar (--bg, 32 points, no separator). Pixel diff against the current app, contents still missing: 97.6% (light)
  and 97.68% (dark) identical. Colors: see 2e (the first finding here, that WebKit passes colors unconverted,
  was wrong; it held only for near-grays). The Files panel is in the shell; its tree
  comes with the components.
- 2b edges: the 76 icons generated from src/lib/ui/icons.ts (`gm-measure icons`, checked in CI) and drawn from their
  SVG paths (UI/SVGPath.swift, SVGArc.swift, Icon.swift); the header, both activity bars and the status bar
  (UI/HeaderBar.swift, ActivityBars.swift, StatusBarView.swift) with the snapshot's sizes. Pixel diff 97.74%
  (light) and 97.83% (dark). Disabled buttons use 40% opacity without SwiftUI's .disabled(), which dimmed them a
  second time. gm-measure brings each app to the front before capturing, as macOS stops painting a covered web
  view. The status bar follows the installed release (the word "Memory"), not the GM-26 icon on develop.
- 2c Changes list and commit box (UI/ChangesPanel.swift, FileRows.swift, CommitBox.swift): the heading with its
  count and repository actions, the Staged and Changes groups, the rows with their status letter colors, and the
  commit box. Pixel diff 98.05% (light) and 98.15% (dark). WebKit's own form looks (the #a9a9a9 placeholder, the
  12-point checkbox) are measured constants (WebKitDefaults), as no theme token holds them. Known gap: the heading
  title is cut to "CHA..." where WebKit cuts it to "CH...", same width, different ellipsis rule.
- 2d Files panel (FilesModel.swift, UI/FilesPanel.swift; bridge `list_directories` with the shared FolderLister):
  the heading with its five buttons, the tree with chevrons, icons and names, folders that open and close, and the
  status tones (a folder's dot and name take the strongest tone inside it). Pixel diff 98.08% (light) and 98.17%
  (dark). Not yet: deleted files in the tree (the current app lists them though they are gone from disk), and a
  file's letter by its exact change (U for untracked) instead of its tone's letter.
- 2e welcome screen (UI/WelcomeView.swift): the breadcrumb crumb, the logo tile, the folder name and the six
  actions with their shortcuts. Colors corrected (CSSColor.swift): WebKit converts each sRGB color to Display P3
  with exact math and rounds to 8 bits (#3574f0 shows as #4573e8; near-grays stay as written), and blends
  translucent colors after that conversion. The native app does the same conversion and hands macOS the rounded
  Display P3 value; macOS's own conversion rounded some colors one step off. The title bar alone keeps macOS's
  conversion, as macOS draws it in both apps. Pixel diff with every part of the Changes screen: 98.23% (light) and
  98.59% (dark); with tolerance 1, 98.9% and 98.93%.
- 2f matching to 99%: light 99.06% and dark 99.12% exactly identical (99.4% and 99.45% with tolerance 1). What
  closed the gap, each found by measuring both screenshots (gm-measure plus ink-position scripts):
  - Font smoothing off for the app (AppleFontSmoothing 0), as the page's -webkit-font-smoothing: antialiased;
    macOS's default smoothing made every glyph a pixel wider and taller.
  - Translucent fills and CSS opacity drawn as one solid color blended the way WebKit blends (each converted 8-bit
    channel mixed and rounded; Theme.over): the active activity tile, the logo tile, the half-opacity Commit button,
    disabled buttons, deleted letters. macOS's compositing landed one step off over the whole area.
  - A centered column placed on whole points, as WebKit lays out a centered flex column (WholePointCenter).
  - A file's smaller folder name on the name's baseline, as one line of text on the page.
  - Two measured one-pixel corrections on the welcome screen's text. WebKit's line boxes are whole points while
    SwiftUI's are fractional, so text can round to the neighboring pixel row; a general Core Text text view is the
    fix if more text needs it.
  - What remains: the edges of text, icons and rounded corners (anti-aliasing), the title bar's title as macOS
    draws it in each window, the live memory readout (the apps really differ), and the Changes title cut to "CHA..."
    where WebKit cuts it to "CH...". Text positions come from the screenshots, not the snapshots: inspect_elements
    rounds boxes to whole points, while WebKit places them at fractions.
- 3a diff screen: a click on a changed file (or `app action=show_diff`) opens its side-by-side diff: the editor
  tab, the toolbar, the Index and Working Tree labels, both panes with line numbers, tinted changes, folded
  unchanged runs, the revert column and the change overview ruler. The bridge's `get_file_diff` reads the texts
  and hunks with the shared `diff` module; the rows, folds, ruler ticks and row positions are pure logic in
  `Sources/NativeCore` (NativeCore, tested). Pixel diff of the diff screen: 97.03% (light) and 97.02% (dark). Findings:
  - CodeMirror's 16.25-point lines land on 16-point rows, the text centered in them.
  - rgba() fills are blended premultiplied (each part rounded on its own, CSSColor.filled), one step away from
    the opacity blend in some channels.
  - Ligatures stay off by a zero-width non-joiner between symbols (JetBrains Mono joins <= and =>).
  - Not yet (3b): syntax colors, changed-word highlights, indent guides; that is most of what still differs.
- 3b diff screen to 99%, against 0.1.0-beta.7 (the installed release, plus the GM-40 fold fix, measured with
  `--current-app`):
  - Syntax colors from the current app's own grammars and highlighters (Highlight/entry.ts, bundled with Bun
    into highlight.js and run in JavaScriptCore, dropped after 5 idle seconds), bracket pair colors, indent guides
    (IndentGuides), and CodeMirror's character diff ported line by line (CharDiff*, checked against 560 random
    CodeMirror cases) for the changed-word boxes.
  - Beta.7's look: fold bars without the marks, with "10 lines" step buttons drawn (not clickable yet), the
    commit box layout button in the Changes header, the memory icon in the status bar (ByteText).
  - Text, measured with a WebKit test page (each color on its background, with white-on-black rows for the
    coverage): the glyph coverage is the same 8-bit mask in both apps, but WebKit blends with the text color's
    exact converted value, not its rounded bytes, on the GPU in half precision (#ffd700 shows green 217, not 216).
    Code text is in its own layer: the text over the line's tint is stored in 8 bits there, then composited over
    the editor; the gutter's line numbers blend straight onto their background. GlyphCompositor does both
    (TextUnder), from a 16-bit buffer, so no text pixel is off by Core Text's 8-bit rounding.
  - rgba() fills are stored premultiplied in 8 bits and composited in half precision (CSSColor.filled), which
    changed one color: a changed word's box over the editor.
  - Pixel diff below the title bar (`gm-measure measure` reports it next to the whole window): diff screen 99.04%
    (light) and 99.01% (dark), Changes screen 99.31% and 99.3%. Whole window: diff 98.92% and 95.51%, Changes
    99.21% and 99.31%. The title bar is drawn by macOS in both apps; in dark it renders one step off in some runs,
    which alone costs about four points.
  - Run-to-run noise: the native app's SwiftUI parts render one step off in some launches (about one in four, at
    random), while DiffCanvas and the whole current app stay identical. It moves the score by about 0.1%; the
    numbers above are from the worse kind of run. Not the window's color space, depth, position or EDR headroom.
  - The current app keeps "Collapse unchanged" in WebKit localStorage under the real ~/Library, shared with the
    user's own Git Manager; gm-measure sets it for a run and puts the user's value back (CurrentAppPrefs).
  - Re-measured 2026-10-08 against the installed 0.1.0-beta.7: Changes 99.17% (light) and 99.13% (dark). The
    installed beta.7 never folds side by side diffs (the GM-40 bug), so its diff screen scores 81.4%; the diff
    screen is compared with the fixed build instead: 99.04% light, 98.28% dark. The dark drop comes from the
    current app, not the native one: on the same builds, beta.7 painted the scrollbar thumb as red 68 (69 the day
    before) and a changed word's box as 57, 79, 133 (58, 79, 134 before), while the native pixels did not move.
    Not Low Power Mode, not battery (re-measured on the charger), not a system update, not WebKit itself (the
    WebKit test page with the same tints renders 100% identical to the day before), not localStorage. Beta.7's
    own screenshots differ by 4.4% between the two days, its diff layer one step lower; every run today gives the
    same variant. The reference drifts by one step, so exact dark scores move with it.
    From then on the reference is a local build of the latest develop (0.1.0-beta.7) plus the GM-40 fix, the
    default of gm-measure when it exists. Against it: diff 99.14% light, 98.29% dark; Changes 99.12% dark. In dark,
    only the fills at alpha 0.35 and some code text edges moved: the thumb fits an unrounded alpha (89.25), the
    changed-word box fits no model tried.
- Memory with a big file (`gm-measure memory`, from 3a on, after every feature): a 4000-line PHP file with every
  eighth line changed, shown as a diff that folds nothing and scrolled down and back at 200 points a frame:

  | Phase | Current app | Native app |
  |---|---|---|
  | Idle, folder open | 136 MB | 32 MB |
  | Diff open | 218 MB (+82) | 60 MB (+29) |
  | Scrolling (average, peak) | 651 MB, 782 peak (+515) | 71 MB, 81 peak (+40) |
  | After scrolling | 247 MB (+111) | 61 MB (+30) |

  The panes are drawn by one view the size of the viewport (UI/DiffCanvas.swift): it paints only the rows on
  screen, found by binary search (RowIndex in NativeCore), into a Display P3 bitmap. The first version used
  SwiftUI's lazy stack, which kept every row it had built: 113 MB while scrolling and 110 MB after, against 71 and
  61 now. AppKit's own backing store converted the colors one step off (#1e1f22 as 31, 32, 34), so the canvas
  paints into its own P3 bitmap, where the values pass through as SwiftUI's do. Frame counts depend on the window
  staying in front and on what else the Mac is doing (both apps dropped frames in the same run), so only memory is
  compared; the scroll walk holds off App Nap so its timer keeps time.

  Re-run with 3b (syntax colors in JavaScriptCore, beta.7 as the current app): current 141 / 216 / 921 / 321 MB
  (idle, diff open, scrolling, after), native 34 / 85 / 80 / 78 MB. JavaScriptCore adds about 24 MB while a diff
  is open.
- GM-43 parity list and UI match per scenario: `swiftui/Parity` lists all 59 features of docs/wiki/features.json
  plus the window shell, each with a scenario (steps that reach it in both apps on the docs demo), the native status
  and the last numbers; README.md and Scenarios*.md there are generated from the JSON (`gm-measure parity summary`),
  and a Swift test fails when a wiki feature is missing or the pages are stale. Today: 1 done (window shell),
  14 partial, 45 missing; 2 of 46 scenarios run in both apps. `gm-measure parity` runs those scenarios in both apps
  and both modes and reports per scenario the match below the title bar, the overlay, memory and what is missing in
  native; a failed launch or capture is written next to its scenario. `.github/workflows/native-parity.yml` does the
  same on GitHub against the newest beta release, after granting Screen Recording through TCC entries
  (`swiftui/scripts/ci-allow-screen-capture.sh`); it has not run there yet. Measured 2026-10-08 against the
  installed 0.1.0-beta.7 (on battery, Low Power Mode):

  | Scenario | Light | Dark | Memory current / native (light) |
  |---|---|---|---|
  | changes | 99.18% | 99.13% | 150 / 32 MB |
  | diff (src/cart.ts) | 81.35% | 74.95% | 207 / 68 MB |

  The diff scores low because beta.7 never folds side-by-side diffs (GM-40, not released); against the fixed build
  it scored 99.04% and 98.28%. The control server binds port 0, so native builds from several worktrees never
  collide.
- GM-45 diff interactions and scrolling, measured 2026-10-08 against a local build of 0.1.0-beta.7 plus the
  GM-40 fold fix (the installed beta.7 never folds side by side, so its folded diff is not a fair reference):
  - "Collapse unchanged" works and is kept in `~/.gitmanager-native/diff.json` (on by default, like
    src/lib/diff/prefs.svelte.ts). A new diff, or the toggle, centers the first change as DiffView.svelte does
    (CodeMirror's scrollIntoView with y "center": the 17-point cursor box from a point above the row, WebKit
    dropping the fraction; beta.7 scrolls src/cart.ts to 82). Previous and next change move the counter and center
    their change; a fold bar's "10 lines" buttons open 10 lines at their edge and the rest of the bar opens the
    fold (DiffNavigation in NativeCore, tested; the `app` tool's `diff` action and `gm-measure smoke` drive them).
  - Found while matching: once the rows are taller than the view, the merge view's 10-point vertical scrollbar
    (hidden under the ruler) takes its room from the panes, 5 points each. The right pane's horizontal thumb was
    5 points long because its scroll width includes the cursor line's blame note ("You, Uncommitted changes" 36
    points after the line, in a layer of the scroller), and WebKit sizes thumbs in whole points.
  - Pixel diff below the title bar: collapse off 99.11% (light) against both the local build and the installed
    beta.7; folded 99.13% (light). Dark: folded 98.16%, collapse off 85.23% (99.39% with tolerance 1): once the
    merge view scrolls, the current app paints the right pane's code area #1e1f22 as 30, 31, 33, one step off from
    its own gutter and left pane (30, 31, 34), the way macOS converts the title bar; not chased, like the other
    dark one-step fills of that day.
  - Scrolling: the walk's frames took 31.8 ms (633 of 634 over 25 ms), of which painting the canvas was 13.4 ms.
    A sample of the app (`sample`, outside the sandbox) showed the rest: Core Animation converted the whole Display
    P3 image to the screen's color space (Color LCD) on the main thread every frame (about 1570 of 4780 samples).
    The canvas now paints in the window's own color space, which leaves every pixel the same and skips the
    conversion; on a scroll it moves the pixels it has and paints only the rows that came into view (each row with
    what spills from its neighbors, so a band paints the same pixels as a whole paint: `measure --walk` shows no
    canvas pixel change after scrolling down and back); and glyphs are cleared and blended only over the columns
    a line can ink, not the canvas width. Colors are worked out once per theme (CanvasColors). After: frames 16.7
    ms (one display frame, 1 of 634 over 25 ms), paint 4.5 ms average (5.1 ms p95). Beta.7 in the same run: 16.9
    ms, 13 frames dropped.
  - Memory (`gm-measure memory`, idle / diff open / scrolling / after, MB): before, current 145 / 222 / 896 / 276,
    native 34 / 84 / 81 / 98; after, current 142 / 222 / 894 / 264, native 34 / 52 / 46 / 45. The converted copy
    of the canvas Core Animation kept is gone.
- 3c stage, unstage and commit (GM-44), measured against the local reference build (origin/develop 0.1.0-beta.7
  plus the GM-40 fold fix, `--current-app`):
  - Bridge: `stage_files`, `unstage_files`, `commit`, `commit_all`, `get_head_message`, `last_action` and
    `move_head_back` (soft only) in `bridge/src/commands/write.rs`, named and shaped like the Tauri commands and
    run through the shared git CLI code; commit options come from src-tauri's own `commit_options.rs` by path.
    Tests over real repositories with an empty global git config (`bridge/tests/writes.rs`): stage and unstage
    (deletions, before the first commit), commit, Commit All, Amend with an empty message, Undo of a commit and of
    an amend, and failures (nothing staged, a bad author, a pre-commit hook's own message).
  - The window: rows and group headers show --hover and their buttons under the mouse (Discard and Stage, Unstage;
    Stage all, Unstage all and Discard all), a double click stages or unstages, writes run like repoStore.run (the
    label with a spinner in the header and the status bar, the branch, sync, commit and Amend controls off, an
    error toast "<label> failed" with git's text, the status read again after), the open diff follows its file
    into the other group, the commit box follows CommitBox.svelte (Commit only with a message and staged files,
    Amend fills a blank box with the last message, Cmd+Return), "Committed" comes with an Undo button, and a clean
    tree shows "Working tree clean". Discard is drawn but only says it is not built yet.
  - The rules are pure logic in NativeCore with tests: CommitRules, ChangeSelection, Notices, CommitUndo.
  - Toasts as measured in beta.7 (inspect_elements on a "Fetched all remotes" and a "Fetch failed" toast): 16
    points from the corner, at most 420 wide, 10 and 12 points of padding, a 4-point left edge in the kind's color,
    the detail in 11.5-point mono scrolling past 160 points, and the bell's red or amber badge for unread alerts.
    Hover and busy looks come from the CSS: beta.7 cannot be hovered from outside (posting mouse events needs
    Accessibility access) and its busy state lasts a few milliseconds.
  - Pixel diff below the title bar: Changes 99.17% (light) and 99.29% (dark); after staging src/cart.ts in both
    apps (`gm-measure measure --screen staged`) 99.17% (light) and 99.12% (dark). An earlier light run of the same
    code gave 99.31% and 99.33%: the one-step SwiftUI noise of 3b.
  - Memory, native: idle 36.0 MB (34.2 before), 36.4 MB after staging, 36.7 MB after staging and bringing the
    window forward, 36 to 38 MB after a commit and its toasts. Each change of the screen (the busy label, a toast
    appearing) costs about 50 MB of GPU drawables for about a second. Big file (`gm-measure memory`): 34.2 / 86.0 /
    82.0 / 79.8 MB (idle, diff open, scrolling, after), as before. Two findings on the way: a hidden shortcut button
    for Cmd+Return, and macOS window restoration, each left a 19 MB window snapshot in memory (AppKit's
    NSPersistentUIWindowSnapshotter, found with malloc stack logging) once the window became active. Cmd+Return is
    now a key monitor that lives only while the message has the focus, and the window is not restorable
    (WindowSizer puts the saved frame back itself).
  - Not yet: the identity check before a commit (git's own error shows instead), Commit Options, the message
    history and templates, and Discard; the Undo of a pushed commit asks with a plain macOS alert.
- GM-50 the dark "every line" diff at 85%, found to be the capture, not the page (2026-10-08, HDR off):
  - What was seen: with Collapse unchanged off, the current app's right editor showed #1e1f22 as 30, 31, 33, its
    text and guide edges one step off, and the title bar 30, 31, 33; some runs scored 99.2%, others 85.5%.
  - Probing the real app (isolated launches, many captures of one window): the same window, untouched, flips
    between two results from one CGWindowListCreateImage call to the next. The second result changes only the
    surfaces macOS must convert or blend: the title bar, WebKit's composited layer of the right editor (once the
    merge view scrolls) and the translucent code text layers of both panes. A test window with plain layers does
    the same: an sRGB-tagged layer of 30, 31, 34 comes back as 30, 31, 33, a translucent Display P3 layer one step
    off, while opaque layers in the display's space never move. The native app flips too (its title bar and
    SwiftUI text), which was the "one-step SwiftUI noise in some launches" of 3b.
  - ScreenCaptureKit and full-screen captures always give the first result, so that is what the display shows.
    With HDR headroom, CGWindowListCreateImage also gave it, which is why HDR on looked "right".
  - Fix: gm-measure captures through ScreenCaptureKit (MeasureKit/LiveWindowCapture.swift, macOS 14 and later;
    CGWindowListCreateImage stays only as the fallback before 14). The dark rules that the diff canvas used without
    HDR headroom (Theme.nsLayers, CSSColor.composited) were fitted to the second result, so the canvas now always
    uses the rules of the live composition (DiffCanvas.extendedRange); no separate rules for the right editor are
    needed.
  - Pixel diff below the title bar, against the local reference build, HDR headroom 1.0, every run the same:

    | Screen | Light | Dark |
    |---|---|---|
    | Diff, folded | 99.26% | 99.22% to 99.24% (98.65% to 98.89% before) |
    | Diff, every line (`--collapse off`) | 99.25% | 99.19% to 99.2% (85.42% to 85.49%, or 99.2% by chance) |
    | Changes | 99.35% | 99.33% |
    | After staging | 99.35% | 99.34% |
