# Blame Bugs We Fixed

The bugs found in [blame](How-Blame-Works.md) (the current-line note and the gutter), what caused each, and why we fixed it the way we did. The user side is in [Blame](../usage/Blame.md).

**The blame note took a line and got in the way of clicks.**
- **The issue:** on a long line (or with word wrap on) the note wrapped onto its own row, so moving the cursor made every line below jump by one row as the click landed. After a click past the end of a short line, the note appeared right under the pointer and caught the next click or drag, opening the Log.
- **Why it happened:** the note was an inline widget at the end of the line, so it took room in the text and could wrap; it was always clickable, and it stopped mouse-down to keep the cursor in place.
- **The fix and why we chose it:** the note is drawn in its own layer (`inlineMarkers`, with the placement in `inlineBlameLayout.ts`), beside the end of the line's last visual row, like CodeMirror's cursor; it takes no room and ignores the mouse unless Cmd (Ctrl elsewhere) is held, like a link. Like GitLens and Zed it always follows the end of the line: with word wrap off it runs past the edge (scroll right to read it), with word wrap on it is cut short with an ellipsis. A first version hid the note on long lines, and the user missed it there, so it now always shows. A modifier keeps click-to-open without stealing clicks meant for the code.

**Blame never appeared on first open.**
- **The issue:** on first open, a file could show no blame at all.
- **Why it happened:** the only blame call was in `loadHead`, which starts before `createEditor`. With no editor yet, `refreshBlame` did nothing.
- **The fix and why we chose it:** `createEditor` in `FileView.svelte` also calls `refreshBlame`, so blame loads as soon as the editor exists, whatever order the two steps finish in.

**Back did not return to where you clicked blame.**
- **The issue:** after clicking a blame note and landing in the Log, Back skipped your spot and went to an older one.
- **Why it happened:** the history only recorded file locations, so the jump to the Log was never a step.
- **The fix and why we chose it:** history steps can now be Log commits, and `openCommit` records the exact clicked line first. That matters for gutter clicks, which may not be on the cursor line. Diffs became steps too, so Back works from blame in any view.

**The Log did not open on the line you clicked.**
- **The issue:** clicking a blame note opened the right commit and file in the Log, but the diff stayed at the top or the first change, not at your line.
- **Why it happened:** `openBlame` never passed a line to `openCommit`, so the commit diff had nothing to scroll to. The backend also dropped the original line number that `git blame --porcelain` reports, so blame knew no lines of the commit's version.
- **The fix and why we chose it:** the backend now keeps git's original line numbers (`originalLines` in `BlameInfo`), and a blame click sends the line as it is in that commit. When that is unknown (for example a line typed since), it sends the same line number plus the line's text, and `findLine` in `log/lineMatch.ts` picks the nearest line with that exact text in the commit's file. Using git's own number is exact; the text search keeps it working when lines have moved.

## Keeping this page in sync

Add an entry here for every blame bug you fix, in the format of [Docs and Screenshots](Docs-and-Screenshots.md), and keep the newest first.
