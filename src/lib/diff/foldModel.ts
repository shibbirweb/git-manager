// Folded runs of unchanged lines in the diff: where they go and how they open a few lines at a
// time. Line numbers are 1-based and inclusive, like CodeMirror's.

/** Lines one click on a fold's edge shows. */
export const FOLD_STEP = 10;
/** Unchanged lines kept visible next to each change. */
export const FOLD_MARGIN = 3;
/** Fewer unchanged lines than this are never folded. */
export const FOLD_MIN_SIZE = 4;

export interface FoldRange {
  first: number;
  last: number;
}

/** A change in one text: its first line and the line right after it (the same line when the change has no lines on this side). */
export interface ChangeLines {
  first: number;
  after: number;
}

export type FoldEdge = "top" | "bottom" | "all";

/** The runs between changes to fold, keeping `margin` lines next to each change. */
export function foldRanges(
  changes: readonly ChangeLines[],
  lineCount: number,
  margin = FOLD_MARGIN,
  minSize = FOLD_MIN_SIZE,
): FoldRange[] {
  const ranges: FoldRange[] = [];
  let previous = 1;
  for (let index = 0; index <= changes.length; index++) {
    const change = changes[index] ?? null;
    const first = index === 0 ? 1 : previous + margin;
    const last = change ? change.first - 1 - margin : lineCount;
    if (last - first + 1 >= minSize) {
      ranges.push({ first, last });
    }
    if (change) {
      previous = change.after;
    }
  }
  return ranges;
}

/** The run still folded after showing lines at one edge, or null when it opens fully. */
export function revealFold(range: FoldRange, edge: FoldEdge, step = FOLD_STEP, minSize = FOLD_MIN_SIZE): FoldRange | null {
  // A step that would leave only a sliver folded opens the rest too.
  if (edge === "all" || range.last - range.first + 1 - step < minSize) {
    return null;
  }
  return edge === "top" ? { first: range.first + step, last: range.last } : { first: range.first, last: range.last - step };
}

/** The edges that show lines a step at a time: only edges next to visible code, and only when a step leaves a fold. */
export function foldEdges(range: FoldRange, lineCount: number, step = FOLD_STEP, minSize = FOLD_MIN_SIZE): { top: boolean; bottom: boolean } {
  if (range.last - range.first + 1 - step < minSize) {
    return { top: false, bottom: false };
  }
  return { top: range.first > 1, bottom: range.last < lineCount };
}
