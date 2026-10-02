// Show History for Selection: `git log -L` reads line numbers against HEAD, while the
// selection is in the editor's text, which can have uncommitted lines above it.

import { diffLines } from "$lib/editor/lineDiff";
import type { LineRange } from "./github";

/**
 * The committed (HEAD) lines that `workRange` of the working text covers, both 1-based and
 * inclusive. A line inside a changed block maps to that block's committed lines; lines added
 * since HEAD map to nothing. Null when none of the selected lines exists in HEAD.
 */
export function headLineRange(headLines: string[], workLines: string[], workRange: LineRange): LineRange | null {
  const selectionStart = workRange.start - 1;
  const selectionEnd = workRange.end;
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  const take = (from: number, to: number) => {
    first = Math.min(first, from);
    last = Math.max(last, to);
  };
  // Unchanged lines between hunks sit at a fixed offset from their HEAD position.
  const takeUnchanged = (from: number, to: number, offset: number) => {
    const start = Math.max(from, selectionStart);
    const end = Math.min(to, selectionEnd);
    if (start < end) {
      take(start + offset, end + offset);
    }
  };

  let offset = 0;
  let cursor = 0;
  for (const hunk of diffLines(headLines, workLines)) {
    takeUnchanged(cursor, hunk.newStart, offset);
    const overlaps = hunk.newStart < selectionEnd && hunk.newEnd > selectionStart;
    if (overlaps && hunk.oldEnd > hunk.oldStart) {
      take(hunk.oldStart, hunk.oldEnd);
    }
    offset = hunk.oldEnd - hunk.newEnd;
    cursor = hunk.newEnd;
  }
  takeUnchanged(cursor, workLines.length, offset);

  if (last <= first) {
    return null;
  }
  return { start: first + 1, end: last };
}
