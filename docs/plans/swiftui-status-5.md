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
