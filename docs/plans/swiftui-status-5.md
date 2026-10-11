# SwiftUI experiment: status notes, part 5

Continues [swiftui-status-4.md](swiftui-status-4.md). Newest last.

- GM-85 open gaps, stage 2 (blame):
  - A click on a blame gutter block (or Cmd-click on the current line's note) opens the commit in the Log on the
    clicked line of its version (blame.ts openBlame): LogModel.focus reads the history afresh, loads up to 20 more
    pages until the commit is there (else the toast "Commit is not in the loaded history"), selects it on the file,
    centers it in the list, and the diff centers the line (OpenDiff.reveal). The line is the blame's origin line
    (BlameLines.origins, from the runs' originalStart), else the editor's line found again by its text
    (BlameLines.findLine, lineMatch.ts). Option-click copies the hash ("Copied 1a2b3c4"); an uncommitted line does
    nothing more (the current app shows Changes, which the native app always shows).
  - Tooltips: one tooltip area per gutter block on screen (NSView tool tips, rebuilt as the view scrolls), with
    describe's title (BlameNote.tooltip: summary, author and email, full date, hash, the click hint).
  - The Log reads the history each time it opens and when HEAD moves while it shows, and starts with no filter and
    the newest commit selected, as the page's Log view does when it mounts (it kept a stale history before: found
    by the new smoke check, which runs before the commit check).
  - The diff toolbar's Blame toggles settings.blameGutter (shared with the file bar) and is pressed while on; the
    right pane then gets the 236-point blame gutter after its numbers (DiffCanvasBlame, Pane.gutters), its border as
    tall as the rows and the padding. Changes blames the modified text (blame_contents); the Log blames the file at
    the commit (blame_file, now in the bridge, tested).
  - The file view's overview ruler draws its change ticks (FileRuler, ChangeMarks.ticks); the file bar shows the
    Unsaved and Modified / New file / Conflicted badges, "2 changes" or "1 of 2", and its arrows go to the previous
    and next change, centered (EditorModel.goToChange).
  - gm-measure: `--screen diffblame` and `logblame` (the blame gutter on), `--screen file --file <path>` (a changed
    file: `--file src/cart.ts`). Smoke: a blame click opens the commit in the Log on its line, and the tooltip.
  - Pixel diff below the title bar (HDR off, light / dark): diffblame 99.64 / 99.59, logblame 99.51 / 99.37,
    file --file src/cart.ts 99.61 / 99.62; kept: diff 99.66, file 99.64, log 99.52 / 99.39, blame 99.62 / 99.58
    (floor 99.63 / 99.59, within the 0.01 noise).
  - Memory: diffblame current 160 / 160 MB, native 42 / 42 MB; logblame 150 / 151 against 48 / 46; file with
    src/cart.ts 250 against 44 (dark).
  - Not built: Back after a blame click (no navigation history in the native app yet).
- GM-86 open gaps, stage 3 part 1 (Go to Line):
  - Code > Go to Line... (Cmd+L, a menu item as on the page, so the key works wherever the keyboard is): the
    page's prompt (DialogHost.svelte) asks "Line[:column] (1-N)" from the cursor's "12:5" (selected), keeps an
    invalid answer with "Enter a line number, optionally with :column" and Go off, and puts the cursor there,
    centered (EditorCommands.parseLineTarget / lineTargetPosition, textCommands.ts). The editor takes the keyboard
    back after.
  - DialogCenter (per window) and PromptDialog: the page's dialog host for prompts, on GitDialogFrame (now with
    DialogHost's 14% top and 18-point actions gap); `app action=dialog` answers or cancels it for the control
    server, and `editor_command code.goToLine` opens it.
  - Found on the way: an autofocused field (SearchInput) could miss the keyboard when it appeared over the editor
    (the editor kept it, typing went into the file); it now retries until it is in its window, and the editor no
    longer takes the keyboard while a dialog is open. The control state names the window's first responder.
  - gm-measure: `--screen gotoline` (Cmd+L posted) and `gotolineerror` ("12:" typed). Smoke: the prompt, an
    invalid answer and the cursor after "3:2".
  - Pixel diff below the title bar (light / dark): gotoline 99.41 / 99.31, gotolineerror 99.44 / 99.37; kept:
    settings 99.5, welcomeclone 99.59, githubgist 99.32.
  - Memory with the prompt open: current 199 MB, native 45 MB (light).
- GM-87 open gaps, stage 3 part 2 (the find bar), and the new speed gate (the user, 2026-10-10: a feature is done
  only when it is 99%+ identical AND faster than the current app; else find the bottleneck and fix it):
  - Edit > Find (Cmd+F), Replace (Cmd+R), Find Next / Previous (Cmd+G / Shift+Cmd+G), Select All Occurrences: the
    page's find bar (findPanel.svelte.ts) above the code: seeded from a short one-line selection, typing jumps to
    the first match from the cursor, Cc / W / .* toggles (Option+C/W/X), the counter ("3/12", "0 results",
    "Invalid regex"), Replace, Replace All ("2 replaced"), Exclude, Escape. NativeCore FindQuery / FindModel
    (tested against findModel.test.ts and @codemirror/search).
  - Pixel rules found: the 30% match tint is premultiplied with the exact share and only the stored alpha is
    rounded (55, 38, 13 over 77); a selection match inside a find match keeps only the find tint (the base
    theme's `.cm-searchMatch .cm-selectionMatch` is transparent); the toggles use the UI font. The status bar
    gained "(7 selected, 2 lines)" for any selection (StatusFileItems).
  - Speed: `gm-measure speed --case find` (SpeedFind.swift): the 4000-line PHP file, Cmd+F, "stock" typed key by
    key, Cmd+G three times. Native was slower on all four at first (bar 75 vs 71 ms, first key 74 vs 60, settled
    102 vs 32, Cmd+G 63 vs 45). Bottlenecks found with run-loop trace marks and `sample`, and fixed:
    - Every change repainted the whole editor (about 14 ms): a selection change now repaints only the rows it
      touches, a new search only the rows whose matches change (FileCanvasRepaint.swift), nearby rows share a
      band, the text spill is 4 points, the editor background is the layer's color (no bitmap to fill), and the
      rows' Core Text lines are cached for the text and colors they were made for (FileCanvasLineCache.swift).
    - Every change re-rendered the tab strip, the Files panel and the whole file screen (EditorModel published
      it): EditorChanges now carries it to the file bar, the ruler and the status items only, published after
      the frame (AfterFrame: a timer, so the canvas commits first); the canvas paints from the session's hook.
    - The window root's min-only frame made SwiftUI lay the whole window out again at 960 x 600 after each change;
      the Shell slots asked their content for sizes; ExactWidthLayout measured its text for every alignment
      question. All three now answer from the room alone.
    - NSTextView's keyDown hid the pointer with a synchronous WindowServer call (SLSObscureCursor, 4+ ms a key):
      FastFieldEditor sends keys to the input system directly and hides the pointer only after it moved.
    - The search joined the whole text for each band and counted with Foundation: ranged searches use their
      lines only, and literal ASCII searches run on bytes (FindQueryASCII.swift, tested against Foundation's).
    - The find counter and the typed text re-rendered the whole bar: FindLabel follows the count alone, and the
      typed text is published only when it turns empty or back.
    - A typed key still repainted the whole rows of every changed match (about 6 ms): a changed find or selection
      match now repaints only its box (DirtyBox), raw pixel work stays inside the band (pixelBand) and Core Text
      renders only the glyphs inside the clip (GlyphCompositor). Opening the bar kept repainting the shorter
      canvas: a surface now keeps its taller bitmap (keepTaller) and paints only rows a taller view shows.
    - The field editor shows the typed text at once (displayIfNeeded and a flush, as NSTextView's keyDown does).
  - Found on the way: row bands reached a point above a row, but a selected match's outline sits two above, so Find
    Next could leave a stale line; bands now reach two. Smoke checks this kind of slip directly: `app
    action=canvas_check` compares the canvas after partial repaints with a whole repaint (it failed with the old
    margin).
  - Result (median of 10, ms, current / native), two batches: bar on screen 78 / 40 and 69 / 41, matches after the
    first key 59 / 45 and 68 / 43, code settled after the last key 35 / 26 and 37 / 30, next match after Cmd+G
    55 / 34 and 47 / 34. Kept: search (10 runs) echo 27 / 18, first results 95 / 79, settled 43 / 38; diff code
    on screen 234 / 96, colors in 234 / 196; scroll 28 / 58 fps, p95 gap 66 / 19.
  - The typing jump keeps 48 points around the match (findPanel.svelte.ts yMargin 48); Find Next the default.
    Parity find-replace (cart.ts, "total"): 99.3 / 99.3; the rest is the page's sticky scroll line (a new gap of
    Code appearance).
  - Smoke: Find, typing jumps (1/2), Find Next (2/2), Replace All ("2 replaced"), Undo and Escape, canvas checks
    (control: `editor_command edit.find|edit.replace|edit.findNext|edit.findPrevious|edit.closeFind`,
    `app action=find`, `app action=canvas_check`).
  - Pixel diff below the title bar (light / dark): findbar 99.58 / 99.57, replacebar 99.59 / 99.56; kept (sweep of
    18 screens): all at their floors within the 0.01 noise. The floor table's search 99.6 predates GM-75 (99.46 /
    99.22 since then, as on 2026-10-09).
  - Memory with the replace bar open: current 215 MB, native 44 MB (light).
- GM-88 open gaps, stage 3 part 3 (code completion), the 99% and speed gates:
  - Typing a word in the file editor opens the page's completion popup (features.ts completionExtension):
    the document's words (wordCompletion.ts: 1500 lines around the cursor, 400 words, nearest first) and the
    language's own sources, the keywords, snippets and scope names of each @codemirror/lang-* package. Keys:
    Ctrl+Space asks, Escape closes, Up/Down (wrapping), Page Up/Down, Enter and Tab pick; a key in the first
    75 ms after the popup opened goes to the editor (interactionDelay). A click on an option picks it. Snippets
    ("for", "function", "if" ...) insert their text with the first field selected; Tab and Shift+Tab move between
    fields, Escape or moving out lets go. Settings editorCompletion and editorCompletionOnTyping are read.
  - NativeCore/Completion ports the package: FuzzyMatcher (scores and matched ranges, tested on
    Fixtures/cm-fuzzy.txt from the package's own class run under Bun; its byWord buffer keeps its length between
    matches, as the page's does), sortOptions (score, then the "en" locale compare, which orders as
    localeCompare; the same label twice is listed once, a typed one wins), the state machine (ActiveSource,
    ActiveResult, CompletionDialog, validFor with JavaScript's ASCII \w and \d spelled out for ICU),
    insertCompletionText for every cursor, rangeAroundSelected (100 options rendered), snippet fields, and the
    popup's geometry. WordCompletion is tested on Fixtures/cm-words.txt from wordCompletion.ts.
  - The language's sources run in JavaScriptCore in the highlighter's context (Highlight/complete.ts,
    SyntaxCompletion.swift): the last file's EditorState is kept and updated by the changed span only, so the
    parse is incremental (2 ms a key on cart.ts, 23 ms cold). A snippet's apply function runs there too against a
    stand-in view and answers its changes, selection and fields. Sources are in the page's order: the words first
    (its global language data comes before the language's), so the word "for" of a comment ties ahead of the
    "for" loop snippets, as on the page.
  - Native asks at once after a typed key (after the key's own paint); the page waits 100 ms
    (activateOnTypingDelay). Ctrl+Space waits 50 ms as there.
  - Popup pixel rules: placed at the completed text's left below the cursor box (lineTop - 1 to + 16), on whole
    device pixels (WebKit snaps the layer); rows 22 points (a 20-point line box), label baseline 15, badge circle
    12.625 at 6 + 5.1, its letter (UI font 9.36 semibold) a point above its centered line box; the selected
    row's --selected is a Core Animation layer under a see-through row (a fill in the bitmap came out a step off
    in green), its text blended see-through; the shadow is PopupShadow in its own layer (the page-layer profile
    scored lower). Dark --shadow alpha comes from the theme.
  - Found and fixed on the way:
    - Go to Line and change navigation lost their centering and the keyboard since GM-87 (the center request
      came after the dispatch, and nothing repainted the editor view later): asked before the dispatch now.
      Centering also uses the client height less the horizontal scrollbar and whole points, cut down, as
      scrollRectIntoView and WebKit do (the cursor line was 4.5 points off).
    - The Go to Line prompt took 0.9 s to take the keyboard (the page 0.1 s): the dialog backdrop's shadow
      evaluated 96 exp and 192 erf calls per pixel near its corners on the main thread. BoxShadowCorners.swift
      works the corner weights out per column and row (the same sums, bit for bit; tested): 876 ms to 29 ms. The
      field's focus tries are 10 ms apart now (quick main-queue turns could all run before SwiftUI put the field
      in its window, and the typed line went into the file).
    - The tab strip had no unsaved dot: TabCloseButton shows the 8-point --text-dim dot, the close sign under
      the pointer; EditorModel.activeDirty is published only when the active file's state flips.
  - Speed (gm-measure speed --case completion, cart.ts, median of 5, current / native): popup after the first key
    139 / 38 ms, list after the next key 32 / 21 ms. The first popup of each height shows its shadow about 90 ms
    after the popup (ShadowTiles builds that tile in the background; 0.5 s before the corner fix).
  - Smoke: "dis" lists the scope's variable first, Enter picks it; "fo" lists the snippets, Enter inserts the loop
    with "index" selected, Tab to "bound", Tab lets go; partial repaints equal a whole one with fields and after;
    Down/Up, Escape; the popup closes when the editor loses the keyboard (control `app action=complete`).
  - Snippet fields are tinted black at 0x22 in dark themes too: the page's editor theme is not marked dark, so
    the base theme's light rule applies (white scored 99.0 in dark, black 99.2).
  - Pixel diff below the title bar (light / dark): completion 99.37 / 99.3, completionvars 99.36 / 99.28,
    completionsnippet 99.27 / 99.2; the sweep of 20 floor screens in both modes kept every floor (edit light
    rose to 99.6 with the tab's unsaved dot).
  - Memory (gm-measure memory --screen file, the 4000-line PHP file, a new "completion open" phase): current
    307 MB, native 66 MB; with the popup on cart.ts: current 263 MB, native 49 MB (light).
  - Known differences: a line holding an empty snippet field's dotted marker is 1 to 2 points taller on the page
    (WebKit grows its line box around the marker), native rows stay 16 points, so lines below an active snippet
    sit higher until it lets go; the page's sticky scroll line (a listed gap of Code appearance).
- GM-89 open gaps, stage 3 part 4 (column selection):
  - Option+drag in the file editor selects a rectangle (features.ts columnSelection: rectangularSelection with
    Option and without Shift), Cmd during the drag keeps the selection it started from; Settings
    editorColumnSelection (on by default) switches it. NativeCore ColumnSelection ports getPos and rectangleFor:
    tabs expanded, a column past a line's end taken from the pointer's x, short lines given a cursor at their
    end, offsets for columns past 2000 characters (and the page's own line.to + endOff sum there); tested on
    Fixtures/cm-rectangle.txt from the package's function run under Bun (20 cases, tab sizes 4 and 2).
  - The pointer: WebKit's I-beam over the editable text (the native editor showed an arrow everywhere), an arrow
    over the gutters, a crosshair while Option is held (crosshairCursor), switched as Option goes down or up.
    EditorDocumentView moved to its own file for it.
  - A drag cannot be posted to either app (and the user's pointer is never moved), so gm-measure `--screen
    columnselect` makes the same selection in both: the native app by `app action=column_drag` (the host's own
    press and drag code), the current app by Select All Occurrences inside "Acme" on lines 11 to 13 of
    catalog.ts, the same three ranges. Pixel diff below the title bar: 99.6 / 99.59 (light / dark).
  - Speed: the page cannot be timed (no drag reaches it); the native press and drag step take 0.4 to 0.5 ms on
    the main thread (the control answer's ms), the paint being the partial repaint of GM-87.
  - Smoke: a block (lines 2 to 5, columns 2 to 4), a ragged one past short lines' ends, Cmd adding, and partial
    repaints equal a whole one. Not checked by a person yet: a real Option+drag and the crosshair.
