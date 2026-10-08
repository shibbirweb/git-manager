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
