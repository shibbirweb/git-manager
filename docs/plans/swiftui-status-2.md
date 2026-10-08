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
