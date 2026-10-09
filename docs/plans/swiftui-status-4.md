# SwiftUI experiment: status notes, part 4

Continues [swiftui-status-3.md](swiftui-status-3.md). Newest last.

- GM-74 speed, first part (the user saw lag in Search Everywhere and when a diff opens; the native app must be
  faster than the current app wherever speed is measured):
  - Tool: `gm-measure speed` times both apps the same way from the outside. FrameRecorder streams the window at
    120 frames a second (ScreenCaptureKit) and keeps each frame's time and region version; a frame counts as a
    change only when a sampled pixel moves more than 3 levels (a 1-level redraw of the toolbar text had counted as
    "settled"). Cases: search (Shift+Cmd+F, "reserve" typed 30 ms a key over 2000 files: first results after the
    first key, settled after the last), echo (a key to the field on screen), diff (a 4000-line PHP diff asked for
    through each app's control tool: first paint, colors in), scroll (the diff walked down and back: frames a
    second, gaps). Both apps settle 6 s after launch first: a LaunchServices clean-up a few seconds after any launch
    held the Objective-C runtime lock and stalled the native main thread. `--frames` keeps pictures of the changed
    frames. A window that opens off the built-in display is moved there through Accessibility (WindowPlacement).
  - Search: the bridge streams Find in Files (`text_search_start` runs the search on a thread of its own,
    `text_search_poll` hands over the batches since the last poll, waiting up to waitMs for the first; tested).
    The popup starts the search on the keystroke and keeps the previous results until the new ones fill the
    visible rows or end. Popup shadows are cached tiles stretched by Core Animation, built off the main thread and
    prewarmed when Search Everywhere opens (ShadowTiles); the full redraw had taken 30% of the main thread.
  - Diff: the highlighter colors each side up to 150 lines past the first change first (Highlight/entry.ts takes
    upTo and folds; NativeCore SyntaxWindow, tested), then the whole text; diffs skip folds. JavaScriptCore starts
    and the code fonts load in the background a second after launch (each ~35 ms on the first diff before, about
    2.4 MB kept). A two-line diff screen is built off screen once after launch (ViewWarmUp: SwiftUI's first-time
    cost of those views, ~100 ms). The ruler draws one shape per kind of tick, not a view per change (500 in the
    bench). The diff's scroll host places its canvas when SwiftUI sizes it, so it paints in the same pass.
  - Numbers (median, light; the machine was loaded during most runs, load average 4 to 9; ms):

    | Metric | Current | Native before | Native now |
    | --- | --- | --- | --- |
    | search: first results after the first key | 69 | 1706 | 100 |
    | search: settled after the last key | 5 | 1932 | 6 |
    | echo: a typed key on screen | 19 | - | 20 |
    | diff: first paint | 261 (62 quiet) | 120 to 181 | 177 (132 quiet) |
    | diff: colors in | 673 (297 quiet) | 3200 to 3700 | 260 (199 quiet) |
    | scroll: frames a second | 53 | 60 | 53 |
    | scroll: 95th percentile gap | 44 | 24 | 28 |

  - Left for GM-75: search's first results. Traced on one clock: the second key at ~30 ms, results ready at ~48 ms
    (the same Rust search as the current app), SwiftUI done building the 18 visible rows at ~82 ms, on screen at
    ~103 ms. Creating the rows costs 20 to 34 ms (updating them 12 ms; offscreen 18 rows lay out in 12 ms and draw
    in 5, ExactText's second pass ~3 ms of that), WebKit a few. Plan: draw the result list directly (Core Text in
    one view, as the diff canvas). Also seen: the TextKit 2 field editor invalidates cursor rects on every key, and
    AppKit then sets the cursor again (~4 ms each with the accessibility pointer settings).
  - Pixel diff below the title bar (HDR off), unchanged: diff 99.66% light / 99.67% dark, staged 99.74 / 99.73,
    Log 99.52 / 99.39, search 99.6 / 99.14, quickopen 99.64 / 99.63, palette 99.5 / 99.3, Changes 99.75 / 99.74.
  - Memory (`gm-measure memory`, idle / diff open / scrolling / after, MB): current 140.7 / 208.2 / 880.3 /
    271.4, native 37.1 / 48.6 / 47.0 / 41.9 (idle was 34 to 36 before: the warm-ups keep 1 to 3 MB).

