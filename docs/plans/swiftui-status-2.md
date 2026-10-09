# SwiftUI experiment: status notes, part 2

Continues [swiftui-status.md](swiftui-status.md). Newest last.

- GM-52 file tabs and the read-only file view (Files panel to editor), against the local reference build:
  - What was built: a click on a file in the Files panel opens it in the preview tab (italic name), a double click
    or `app action=open_file` keeps it; tabs switch and close (EditorTabs in NativeCore, ported from tabs.ts; only
    the active tab's text is in memory). The diff tab and the file tabs share one strip (Views/Editor/
    EditorTabStrip.swift, moved out of DiffScreen). The file view (FileScreen.swift) has the file bar (the path as
    crumbs, previous and next change off, "No changes", Blame, Copy relative path) and the editor (FileCanvas*.swift):
    line numbers, the active line, the word at the cursor and its matches, syntax and bracket colors, indent guides,
    the cursor line's blame note and the blinking cursor; a click moves the cursor. The status bar adds "Ln 1, Col 1",
    "Spaces: 2", "LF" and the language (EditorInfo in NativeCore: languages.ts and indentDetect.ts ported, tested).
    Bridge: `read_worktree_file` and `blame_contents` (commands/editor.rs, tests/editor.rs). gm-measure: `measure
    --screen file`, `reference --screens`, `memory --screen file`, `--current-app` for `memory`, the parity scenario
    `file` (run spec `openFile`), and smoke checks for open_file, the preview tab, the blame note and a missing file.
  - The editor is the GM-48 layer stack again: the view's bitmap is --editor-bg, the scroller's content is one
    see-through 8-bit layer (the active line stored opaque, the word boxes as --accent at 18% with an 8-bit alpha of
    46, text and guides blended in half precision), the gutter opaque over the code in that layer (as WebKit's sticky
    gutter composites above it), and the cursor and each scrollbar thumb are layers of their own. The cursor blinks
    as cursor.ts does (shown for the first half of 1.2 s, restarted when it moves, not when it scrolls).
  - Sizes from the snapshots (Reference/file-<mode>): the line numbers' gutter is at least 40 points (CodeMirror
    sizes it for "99" on a short file), then the 5-point change gutter and the 14-point fold gutter; the text starts
    6 points into the content; the blame note sits 36 points after the line's end in an 11.7-point italic, in a
    17-point box from a point above the row; scrollPastEnd leaves the viewport less 20.5 points below the last line,
    so the vertical thumb shows on a short file too. The status bar's file items end with a 6-point `.gap`.
  - Pixel diff below the title bar, HDR off, ScreenCaptureKit (`measure --screen file`): 99.63% to 99.64% (light,
    three runs), 99.63% (dark, three runs); `parity --scenarios file` the same, 99.63% in both modes. About 17000
    pixels differ; by part (light): status bar right end 6400 to 6800 (the memory readout is real data, 232 MB
    against 42 MB, and the four file items are right-aligned before it, so they move with its width), Changes panel
    and commit box 3800 to 4200, Files panel 1500 to 1600, header 1100, code 1800 (glyph edges one step off, and the
    blinking cursor caught in different phases), file bar 650, tab strip 400, gutter 100 to 300, thumb ends 44. In
    the file bar the "N" of "No changes" lands a quarter pixel right and in the tab the last "s" of "catalog.ts" a
    quarter pixel left of the page's; Core Text has no kern pair for "No", so the cause is not found yet (needs a
    WebKit harness run).
  - Memory with a 4000-line file open in a tab (`gm-measure memory --screen file`, the same generated PHP file as
    the diff benchmark, scrolled down and back at 200 points a frame), MB average:

    | Phase | Current app | Native app |
    |---|---|---|
    | Idle, folder open | 135.0 | 32.3 |
    | File open | 235.6 (+100.6) | 45.3 (+13.0) |
    | Scrolling (average, peak) | 620.9, 717.2 peak (+485.9) | 53.2, 58.6 peak (+20.9) |
    | After scrolling | 276.6 (+141.6) | 38.0 (+5.7) |

    Frames while scrolling: both apps 16.7 ms on average (current 1 dropped, native 2 slow); the native canvas
    painted in 4.85 ms on average (5.75 ms p95).
  - Not yet: editing and saving, a changed file's gutter markers, badge and change navigation, Blame in the file
    bar, folding, binary and image previews (a message shows instead), the crumbs' folder lists, pinning and dragging
    tabs.
  - The other screens after the tab strip moved out of DiffScreen (light / dark, below the title bar): Changes
    99.74 / 99.73%, after staging 99.74 / 99.73%, diff folded 99.66 / 99.66%, diff every line 99.64 / 99.65%, as
    before GM-52 within 0.01.
- GM-53 Log and history (the History activity; src/lib/views/LogView.svelte, src/lib/log/):
  - Built: bridge `get_log`, `get_commit_details`, `get_commit_file_diff` and `resolve_revision`
    (bridge/src/commands/log.rs over the shared git::log and git::diff, tests in bridge/tests/log.rs); NativeCore
    LogGraph (graph.ts's lanes, its test cases ported), LogGraphCell (GraphCell.svelte's strokes and nodes), LogFormat
    (Intl's en-US dates, relative times, ref order, counts, message split) and LogList (visible range with 12 rows of
    overscan, filter, keys, ensure-visible, near-end loading), all tested; the Log screen (Views/Log): toolbar with
    filter, All branches, Refresh, count and close; column heads; rows with graph, ref labels, subject, author, date
    and hash, built only around the viewport under a transparent scroll view (LogScrollHost) that takes the wheel,
    clicks, hover and keys; 300 commits a page, more near the end; the 55% split, the commit's details (subject, Open
    in Tab drawn, Author, Date, Hash with copy, Parent links, changed files) and the file's read-only diff on the
    diff canvas ("Parent" against the commit, no revert column). The History item toggles it; `app action=show_log`
    (`visible`, `position`, `commitId`) drives it; `gm-measure measure --screen log`, `reference --screens log`,
    `memory --screen log` and the parity scenario `log` (the feature-checkout merge, HEAD~5) measure it.
  - Rules found: each Log row is a composited layer (translateY), so a ref label's color-mix fill passes through
    half precision (235.507 red stores as 235); 11-point label text sits half a point lower; text after labels of
    fractional width (and the details' values after the 37.875-point terms) needs ExactText's fraction, mono text
    included (ExactText takes a `face`); WebKit cuts the hash to whole characters and an ellipsis; the commit
    toolbar overflows its 429-point pane, so flexbox shrinks its dividers to 0 (margins stay) and the path to
    nothing, and the buttons that do not fit paint over the Files panel (the main area now draws above it); the
    blame note is the commit's "Author, 2 d ago • subject", which sets the right pane's scroll width; the split
    lines are gradients that Core Graphics dithers one step at random, so the token is the closest. Also the
    activity bar's active mark (2-point accent bar, on the right for the right bar) was missing on every screen.
  - Diff canvas changes (minimal, for the read-only diff): `Content.readonly` and `DiffPanes.gap(readonly:)` (1
    point instead of the 24-point revert column), the toolbar without line actions, `DiffLabels` shared, and the
    blame note text per diff (`OpenDiff.commitNote`). The 8 existing scores did not move.
  - Pixel diff below the title bar (HDR off, local reference build): Log 99.52% light, 99.39% dark (parity
    scenario on the merge commit 99.46% / 99.33%); Changes 99.74 / 99.73, staged 99.75 / 99.73, diff folded
    99.66 / 99.67, every line 99.65 / 99.65. Left: dim row text and code text edges one step off (WebKit blends
    glyphs in the rows' layers), the commit diff toolbar's icons and text (in the current app that pane sits at a
    fractional 491.1 points and is resampled), the dithered split lines, rounded corners, the memory readout.
  - Memory (`gm-measure memory --screen log`, 3000 commits with a merged branch every 40, scrolled at 200 points
    a frame), average MB: current 138 idle, 170 Log open, 250 scrolling (518 peak), 204 after; native 34, 50, 51
    (53 peak), 50.
  - Not built: the right-click menu (Open in Tab, Copy Revision Hash, New Branch Here, Checkout Revision,
    Cherry-Pick, Revert, Interactively Rebase, Reset, Bisect), commit tabs, Open in Tab and Open File, the filter
    beyond typing (Esc, Down into the list), Load more, keyboard in the file list, resizing the details split,
    blame in the commit diff, the inline layout, binary and LFS previews, refreshing after commits and fetches, the
    toolbar's path when the pane is wide enough to show it, and the empty and error states' icons.
- GM-56 Settings and theme switching (src/lib/views/SettingsDialog.svelte, stores/settings.svelte.ts):
  - Built: settings in `~/.gitmanager-native/settings.json` (never the real `~/.gitmanager`) with the current app's
    keys and rules (NativeCore SettingsData, tested): values validated, unknown keys kept on every save, a file that
    is not a JSON object reported in the dialog's banner and never overwritten; `-appearance` sets Theme for a run.
    Theme switching: the window takes `SettingsStore.theme(for:)` on every render, so Light, Dark or System and the
    light and dark color themes (all 42) restyle every screen at once; the header's sun and gear work; the Changes
    header's commit box button follows Settings > Git > Commit box. The dialog (Views/Settings): overlay, frame,
    section list, search (NativeCore SettingsSearch, a port of settingsSearch.ts, tested), every section's rows.
    Working: Theme, the color theme pickers with swatches, Commit box; every other row read-only with its stored
    value. Control: `open_settings`, `close_dialog`; `get_state` adds dialog, theme, colorMode, colorTheme,
    settingsError, settingsScroll. gm-measure: `--screen settings`, `--theme <id>`, reference `settings-*`,
    parity specs `openSettings` and `appSettings` (scenarios `settings`, `color-themes` on Monokai Charcoal), smoke.
  - Rules found: the overlay is its own 8-bit black layer (71 light, 115 dark) composited in half precision (0
    misses). The shadow (0 8px 28px) is a Gaussian of the box times the alpha, rounded to a byte, cut out under the
    box, in a see-through layer above the overlay (ShadowMask). Its width follows the alpha: 0.4964 times the blur
    at the light 0.16, 0.5063 at the dark 0.5, measured on screen (one width for both left dark at 98.71%: the
    reference's stronger shadow shows a heavier tail, each step boundary a pixel further out; 2% wider fixed it,
    while 4% wider or any alpha change made it worse). The dialog paints in an sRGB layer macOS converts (LayerFill:
    --selected 225 green in light, where CSSColor gives 226); in dark the selected row stays one step bluer (90 for
    89) with either conversion, cause not found. The dialog sits at 67.84 points: boxes snap to 68, icons snap from
    67.84 (svgBias). A hint's inline link is laid out on its own. A preference set inside a ScrollView's content
    never reached the views around it, so the scroll offset is read in place.
  - Pixel diff below the title bar (HDR off, local reference build): Settings 99.41% light, 99.03% dark (parity
    99.42 / 99.03); Monokai Charcoal on the Changes screen 99.49% dark, 99.75% light. Other screens unchanged:
    Changes 99.75 / 99.74, staged 99.74 / 99.73, diff folded 99.66 / 99.67, every line 99.65 / 99.65, file
    99.63 / 99.64, Log 99.52 / 99.39. Left in dark Settings: text edges in the dialog (half-precision glyph blending,
    about 28k pixels), the selected row, shadow corners.
  - Memory (parity run, Settings open): current 213 MB, native 46 MB (about 12 MB above the native idle).
  - Not built: the Keyboard Shortcuts list, GitHub sign-in, commit identity and templates, font and terminal
    previews, sliders and selects that work, Reset to Defaults' own dialog (a macOS alert asks), dragging the
    dialog, the memory marks' popovers, per-repository commit boxes, search matches on keyboard shortcuts.
- GM-55 the terminal panel (src/lib/terminal/TerminalPanel.svelte, xterm.js):
  - Built: the Terminal activity item and Ctrl+` show and hide the bottom panel (260 points, the main area's width,
    one point of --panel above it where the page's resize handle sits); its header with the TERMINAL and SHELF tabs,
    the shell's name and folder, New Terminal, the shell menu arrow, Split, Move into Editor Area, Kill, a divider
    and Hide (sizes from TerminalPanel.svelte and inspect_elements); one shell session. The control server answers
    `show_panel`, `list_terminals`, `new_terminal`, `send_terminal_text` and `terminal_text`; gm-measure has
    `measure --screen terminal`, the `terminal` parity scenario (`showTerminal`) and `memory --scenario terminal`.
  - Why not SwiftTerm, as the plan said: the pixels must be xterm.js's, so its view could not be used, and its engine
    is 14 MB of object code (Kitty graphics, sixel, bidi, a Metal renderer, a build plugin and three package
    dependencies, 83 s to build). The shell runs in the current app's own PTY code instead (src-tauri/src/terminal.rs
    and terminal_flow.rs by path in the bridge: the same shell detection, environment, output merging, flow control
    and kill rules), its output comes through a C callback, and the emulator is a port of xterm.js's behaviour in
    NativeCore (parser, buffer with 12-byte cells like xterm.js, CSI, SGR, modes, the alternate screen, scroll
    regions, replies, keys), so programs behave as in the current app. Missing: reflow on resize, mouse reporting,
    xterm's own box-drawing glyphs, find, file links, the scrollbar, several terminals and splits.
  - What the page paints, found by dumping the current app's layers (GM-48's dylib): the terminal is one WebGL canvas
    layer, 773 x 216 points holding 1545 x 432 sRGB pixels (stretched one pixel wider with linear filtering), over
    the DOM's --term-background. xterm.js rasterizes each glyph with WebKit's canvas (Core Graphics) over the cell's
    background, then clears every pixel within (|fg - bg| summed) / 12 of the background, and draws cells with
    nearest texels at whole pixels. Two findings: the cell size and the ASCII glyphs of the atlas warm-up (33 to 125
    in the default colors) come from a canvas outside the page, where WebKit finds only system fonts, so they are
    Menlo with font smoothing on; every other glyph (colors, bold, italic, ~, non-ASCII) is drawn on a canvas inside
    the terminal element, where the user's JetBrains Mono resolves and the page's -webkit-font-smoothing:
    antialiased turns smoothing off, with that font's own descent below the ideographic baseline. The minimum
    contrast ratio 4.5 (xterm's ensureContrastRatio) darkens #00bc00 to #008800 and the like. The native canvas
    (TerminalGlyphs, TerminalFrame, TerminalFonts) now produces the dumped canvas byte for byte: 0 of 667,440 pixels
    differ in light (two dumps) and dark.
  - Centering, found with the panel open: the page centers a flex column on the free space rounded down to whole
    points, then halved, so the welcome column above the panel sits on a half point (WholePointCenter now does
    this; it used to round the position down to a whole point, which left the welcome a pixel high: terminal light
    99.26 to 99.5%, dark 99.15 to 99.38%, Changes unchanged).
  - Pixel diff below the title bar (HDR off, local reference build): terminal 99.5% light, 99.38% dark (parity
    99.5 / 99.38). Others unchanged: Changes 99.75 / 99.74, staged 99.75 / 99.73, diff folded 99.66 / 99.67, every
    line 99.65 / 99.65, file 99.64 / 99.64, Log 99.52 / 99.39, Settings 99.41 / 99.03. Left: colored and styled
    glyphs in the terminal, the welcome's text edges, the memory readout.
  - Memory (`gm-measure memory --scenario terminal`, 4000 lines printed), MB average (peak): current 136 idle, 270
    terminal open, 282 printing, 291 after; native 34, 49, 50 (52), 54.
- GM-57 Quick Open, the Command Palette and Find in Files (search popups), measured against the local reference
  build:
  - Logic in NativeCore, checked against the TypeScript with the same inputs: Fuzzy (src/lib/commands/fuzzy.ts,
    770 query and label pairs run through it by Tests/NativeCoreTests/Fixtures/make-search-fixtures.ts, scores and
    positions identical), QuickOpenModel, SearchRows (fileSearchModel.ts, countLabel.ts), TextSearchModel and
    PopupRows (popupRows.ts), Palette (registry.ts paletteList). The palette's commands, titles, keys and state come
    from the current app's own registry for the docs demo's window (swiftui/Palette/export.ts, `gm-measure
    commands`, checked in CI).
  - Bridge: `file_search_open`, `file_search_query`, `file_search_close`, `text_search` (every batch at once) and
    `text_search_cancel` over src-tauri's file_search, text_search and symbols by path (text_search through a
    `#[path]` folder module, so its `replace` submodule resolves as in src-tauri), tested in bridge/tests/search.rs.
  - The window: Cmd+P, Shift+Cmd+P and Shift+Cmd+F; the popups with their rows, keyboard, the palette's scrollbar,
    and the control actions `quick_open`, `search`, `close_dialog` (which closes Settings too and answers with both
    states). A file opens in a kept tab of the file view, as Go to File does.
  - Rules found: the shadow (0 8px 28px) is close to a Gaussian of 27.6 pixels at 2x, not CSS's 28, but not exactly;
    its edge is a measured table (the 8-bit mask that explains both the light shadow over white and the dark one),
    stored as black at the color's 8-bit alpha times the mask in a layer macOS composites. --selected inside the
    popup shows as macOS converts the sRGB color (215, 225, 252, not WebKit's 215, 226, 252). The input's selection
    is the system color made translucent by WebKit's blendWithWhite, over --panel. Find in Files keeps the code
    font's ligatures. Search Everywhere's icons sit half a point above SwiftUI's snap (its top is 12vh, 101.75).
  - gm-measure: `measure --screen quickopen|palette|search` (the current app driven by open_file, close_tab and
    run_menu_command, as it cannot be typed into from outside), `reference --screens`, `memory-search`, and parity
    scenarios search-everywhere, quick-open and command-palette (run spec `searchScreen`).
  - Pixel diff below the title bar (HDR off): search 99.6% light, 99.14% dark; quickopen 99.64% / 99.62%; palette
    99.51% / 99.29% (parity 99.6 / 99.17, 99.64 / 99.63, 99.51 / 99.3). Others unchanged: Changes 99.74 / 99.73,
    staged 99.74 / 99.74, diff folded 99.66 / 99.67, every line 99.65 / 99.65, file 99.64 / 99.64, Log 99.52 /
    99.39, Settings 99.41 / 99.03, terminal 99.5 / 99.38. Left: the shadow's corners (WebKit tiles the blurred
    corner, not a product of the edges), a match box over the selected row, the input's caret. The quickopen setup
    passed its recent files to the native app reversed (and as a lazy collection JSON could not write); fixed so
    both apps list cart.ts, README.md, pricing.ts.
  - Memory (`gm-measure memory-search`), MB average: current 136 idle, 207 palette open, 188 Go to File with its
    index, 193 Find in Files results (240 peak); native 32, 53, 44, 57.
- GM-54 the merge tool (src/lib/merge/), against the local reference build, HDR off:
  - Logic: model.ts ported to NativeCore (MergeModel, MergeText, MergeNavigation; the result is a list of lines, so
    each action returns the next lines and chunks and undo keeps both), inline.ts as WordDiff, plus the panes'
    decorations, ruler ticks and connector spans (MergePaneLayout) and "highlight the word" (WordMatches); every
    case of model.test.ts and inline.test.ts in Swift Testing. The Rust engine runs as it is: the bridge's
    merge.rs serves list_conflicts, load_conflict, save_resolution, accept_side, load_mergetool, save_mergetool
    over the shared git/conflicts.rs and merge/ modules (bridge/tests/merge.rs, real repositories).
  - Window: the merge tool over the window (MergeView.svelte, 40-point title bar with close) and, started with
    -mergeBase/-mergeLocal/-mergeRemote/-mergeMerged, the git mergetool window (MergeToolApp.svelte, 38 points):
    toolbar (apply non-conflicting from the left, all, from the right; previous and next; undo and redo; Ignore
    whitespace, which reloads), labels, three panes drawn like the diff canvas (only the rows on screen, the page's
    layer stack), the connectors with ribbons and apply/ignore buttons, the overview rulers, the footer (Accept
    Left/Right, Cancel, Apply with the current app's questions), F7, Shift+F7, Cmd+Return and Esc. The conflicts
    list dialog, the operation banner, the Conflicts group in Changes and the status bar's conflict count.
  - Rules found: a tint is the exact converted color times its 8-bit alpha (--diff-conflict's 0.15 gives blue 16,
    the rounded color 15); a connector ribbon's fill is the GPU's half-precision blend of the exact color at its
    8-bit alpha over the background's bytes (dark --diff-modified: blue 74, not 73); each side pane keeps its cursor
    at the start, so "import" is marked wherever it stands (cm-selectionMatch, square, 17 points from a point
    above the row); the gutter is 12 + digits + 10 points, at least 40; CodeMirror's content width is the widest
    line it has measured in the lines it draws (viewport and 1000 points), kept while they overlap, so a pane centered
    on a change never measures the file's top and a pane synced later keeps a long first line's scrollbar; a reveal
    centers in the scroller's client height, the other panes follow a frame later; thumbs are at least 17 points.
  - Why git mergetool for the gate: no control tool of the current app opens its merge tool over the window and
    posting a click needs Accessibility access, while git mergetool shows the same MergeEditor.svelte. That mode
    runs no control server, so gm-measure finds the app by its arguments and reads its memory from outside
    (ExternalMemory, the same counting as get_memory_usage).
  - The conflicts list over the conflict demo, found against the reference (58% / 66% before):
    - The dialog is a child of the overlay on the page, so its box-shadow is painted into the overlay's own layer:
      the dim and the shadow blend there in 8 bits, at the shadow color's exact alpha through the 8-bit blur mask,
      rounded once, and reach the window as one layer (DialogBackdrop shadowInOverlay; the plain dim is masked out
      of the shadow's area). The Settings dialog keeps its own shadow layer. The mask is GM-57's measured BoxShadow
      table for both dialogs now (Settings went to 99.5 / 99.11 with it); the table's last three entries are 1, not
      2: the popups' 8-bit alpha cannot tell them apart, this dark shadow can.
    - A SwiftUI .shadow on the dialog shaded every label and button in it; the page's padding (14, 16, 12) starts
      inside its 1-point border; the selected row is --selected as macOS converts it (LayerFill).
    - Behind the dialog: theme.mix takes a fraction and was given percents (the banner came out black; GM-56's
      Settings search highlight had the same bug, 40 for 0.4); the Files panel lists the files git knows were
      deleted, struck through (FileExplorer's entriesOf); the status bar's Synchronize item follows sync.ts
      (cloud-upload without an upstream, pulls before pushes, shown even when even); the Changes list has the
      page's classic scrollbar, whose track takes 10 points only while the rows overflow (SettingsScroll became
      Components/PageScroll); the change badge is --danger while a file is in conflict and anchored by its right
      edge, so "20" grows to the left.
  - Pixel diff below the title bar (HDR off): merge 99.66% light, 99.59% dark; a 2400-line file (report.ts) 99.25%
    light; conflicts list 99.21% / 99.16% (parity 99.2 / 99.16). Others unchanged or better: Changes 99.74 / 99.73,
    staged 99.74 / 99.73, diff folded 99.66 / 99.67, every line 99.65 / 99.65, file 99.65 / 99.64, Log 99.52 /
    99.39, Settings 99.5 / 99.11, Monokai 99.49, terminal 99.5 / 99.38, quickopen 99.64 / 99.62, palette 99.5 /
    99.29, search 99.6 / 99.13.
  - Memory (git mergetool on report.ts, scrolled at 200 points a frame), MB: current 185 open (WebContent 133);
    native 32 open, 51 scrolling (59 peak), 32 after.
  - Not built: typing in the result pane, the find bar, clicking ruler ticks, Abort and Continue doing real work.
