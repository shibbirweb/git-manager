// Which changed lines an editor selection in the 2-way diff picks, for Stage, Unstage and
// Discard Selected Lines. The backend's hunks give the changes; the result names lines of
// the old (left) and new (right) side, which the backend turns into a patch.
//
// A selection on one side also picks the lines facing it on the other side of the same
// hunk, line by line, so selecting a changed line on the right stages the old line it
// replaces too. A selection that reaches a hunk's last line takes the rest of the other
// side with it. A change that has no lines on the selected side (a deletion seen from the
// right) is picked when the selection touches the lines around it.

import type { LineHunk, LineSelection } from "$lib/types";

export type DiffSide = "old" | "new";

/** The parts of a CodeMirror document the mapping needs (`Text` has them). */
export interface LineLookup {
  lineAt(position: number): { number: number; from: number };
}

/** An editor range as its first and last 0-based line, inclusive. */
export type LineSpan = [number, number];

/**
 * The lines a selection range covers. A range that ends at the start of a line leaves that
 * line out, as when whole lines are selected by dragging; an empty range is its line.
 */
export function rangeLines(doc: LineLookup, from: number, to: number): LineSpan {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const first = doc.lineAt(start).number - 1;
  const endLine = doc.lineAt(end);
  const last = end > start && endLine.from === end ? endLine.number - 2 : endLine.number - 1;
  return [first, Math.max(first, last)];
}

/** Sorted, with touching and overlapping ranges joined. */
export function mergeRanges(ranges: readonly [number, number][]): [number, number][] {
  const sorted = ranges.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** The changed lines `spans` (lines of `side`) pick in the hunks. */
export function selectedChangeLines(hunks: readonly LineHunk[], side: DiffSide, spans: readonly LineSpan[]): LineSelection {
  const oldLines: [number, number][] = [];
  const newLines: [number, number][] = [];
  for (const [oldStart, oldEnd, newStart, newEnd] of hunks) {
    const [mineStart, mineEnd, theirStart, theirEnd] =
      side === "new" ? [newStart, newEnd, oldStart, oldEnd] : [oldStart, oldEnd, newStart, newEnd];
    const mine = side === "new" ? newLines : oldLines;
    const theirs = side === "new" ? oldLines : newLines;
    for (const [first, last] of spans) {
      if (mineEnd === mineStart) {
        // Nothing on this side: the change sits between lines mineStart - 1 and mineStart.
        if (first <= mineStart && mineStart <= last + 1) {
          theirs.push([theirStart, theirEnd]);
        }
        continue;
      }
      const from = Math.max(first, mineStart);
      const to = Math.min(last + 1, mineEnd);
      if (from >= to) {
        continue;
      }
      mine.push([from, to]);
      const pairedFrom = Math.min(theirStart + (from - mineStart), theirEnd);
      const pairedTo = to === mineEnd ? theirEnd : Math.min(theirStart + (to - mineStart), theirEnd);
      if (pairedTo > pairedFrom) {
        theirs.push([pairedFrom, pairedTo]);
      }
    }
  }
  return { oldLines: mergeRanges(oldLines), newLines: mergeRanges(newLines) };
}

/** How many lines a selection holds. */
export function selectionSize(selection: LineSelection): number {
  const size = (ranges: [number, number][]) => ranges.reduce((sum, [start, end]) => sum + (end - start), 0);
  return size(selection.oldLines) + size(selection.newLines);
}
