// The 3-pane diff, like JetBrains IDEs: a merge commit's file (parent 1 | the merge result | parent 2) or the staging
// view of the Changes diff (HEAD | the index | the work tree). Each side pane's hunks against the middle give its
// changes; in a merge, middle lines that both parents' changes touch are a conflict the merge resolved. Everything
// here is line math on half-open, 0-based ranges.
import type { Text } from "@codemirror/state";
import type { ChangeMark } from "$lib/editor/lineDiff";
import type { LineMark } from "$lib/merge/extensions";
import { changedSpans } from "$lib/merge/inline";
import { type Anchor, type ChangeType, invertAnchors, mapLine } from "$lib/merge/model";
import { type FoldRange, foldRanges } from "./foldModel";
import type { LineHunk, LineRange } from "$lib/types";

export type ParentSide = "left" | "right";

export interface ThreeWayOptions {
  /** The right pane is newer than the middle (the work tree against the index): its additions are the right's. */
  rightNewer?: boolean;
  /** Middle lines both sides changed are a conflict (a merge); off for the staging view. */
  conflicts?: boolean;
}

const FLIPPED: Record<ChangeType, ChangeType> = {
  added: "deleted",
  deleted: "added",
  modified: "modified",
  conflict: "conflict",
};

export interface ThreeWayChange {
  index: number;
  /** The parent's lines (the left or right pane). */
  parent: LineRange;
  /** The merge result's lines (the middle pane). */
  result: LineRange;
  type: ChangeType;
}

function hunkType([oldStart, oldEnd, newStart, newEnd]: LineHunk): ChangeType {
  if (oldStart === oldEnd) {
    return "added";
  }
  return newStart === newEnd ? "deleted" : "modified";
}

/** Ranges share a line, or an empty one (a gap) sits inside or at the edge of the other. */
export function touches(a: LineRange, b: LineRange): boolean {
  if (a.start === a.end || b.start === b.end) {
    return a.start <= b.end && b.start <= a.end;
  }
  return a.start < b.end && b.start < a.end;
}

function changesOf(hunks: LineHunk[], others: LineHunk[], flipped: boolean, conflicts: boolean): ThreeWayChange[] {
  const otherRanges = others.map(([, , newStart, newEnd]) => ({ start: newStart, end: newEnd }));
  return hunks.map((hunk, index) => {
    const result = { start: hunk[2], end: hunk[3] };
    const conflict = conflicts && otherRanges.some((range) => touches(result, range));
    const type = flipped ? FLIPPED[hunkType(hunk)] : hunkType(hunk);
    return { index, parent: { start: hunk[0], end: hunk[1] }, result, type: conflict ? "conflict" : type };
  });
}

/** Each side's changes against the middle, from its hunks (side pane = old side, middle = new side). */
export function threeWayChanges(
  leftHunks: LineHunk[],
  rightHunks: LineHunk[],
  options: ThreeWayOptions = {},
): Record<ParentSide, ThreeWayChange[]> {
  const conflicts = options.conflicts ?? true;
  return {
    left: changesOf(leftHunks, rightHunks, false, conflicts),
    right: changesOf(rightHunks, leftHunks, options.rightNewer ?? false, conflicts),
  };
}

/** A diff seen from its other side: the work tree against the index becomes the index against the work tree. */
export function flipHunks(hunks: LineHunk[]): LineHunk[] {
  return hunks.map(([oldStart, oldEnd, newStart, newEnd]) => [newStart, newEnd, oldStart, oldEnd]);
}

/** The middle text with one change taken from a side pane: its lines replace the middle's (stage or unstage). */
export function takeChange(middle: string, side: string, change: ThreeWayChange): string {
  const middleLines = middle.split("\n");
  const sideLines = side.split("\n");
  const taken = sideLines.slice(change.parent.start, change.parent.end);
  return [...middleLines.slice(0, change.result.start), ...taken, ...middleLines.slice(change.result.end)].join("\n");
}

/** The middle pane's marks: both sides' ranges, merged where they touch (a conflict in a merge). */
export function resultMarks(changes: Record<ParentSide, ThreeWayChange[]>, conflicts = true): LineMark[] {
  const ranges = [...changes.left, ...changes.right]
    .map((change) => ({ range: { ...change.result }, type: change.type }))
    .sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);
  const marks: LineMark[] = [];
  for (const next of ranges) {
    const last = marks[marks.length - 1];
    if (last && touches(last.range, next.range)) {
      last.range.end = Math.max(last.range.end, next.range.end);
      last.type = conflicts ? "conflict" : "modified";
    } else {
      marks.push(next);
    }
  }
  return marks;
}

function rangeText(doc: Text, range: LineRange): string {
  if (range.start >= range.end) {
    return "";
  }
  return doc.sliceString(doc.line(range.start + 1).from, doc.line(Math.min(range.end, doc.lines)).to);
}

/** A parent pane's marks, with the words that differ from the result in its changed lines. */
export function parentMarks(changes: ThreeWayChange[], parent: Text, result: Text): LineMark[] {
  return changes.map((change) => {
    const inline =
      change.parent.start < change.parent.end && change.result.start < change.result.end
        ? changedSpans(rangeText(result, change.result), rangeText(parent, change.parent))
        : null;
    return { range: change.parent, type: change.type, inline };
  });
}

/** Line anchors from a parent pane to the result, for scrolling the panes in step. */
export function parentAnchors(changes: ThreeWayChange[], parentLines: number, resultLines: number): Anchor[] {
  const anchors: Anchor[] = [[0, 0]];
  for (const change of changes) {
    anchors.push([change.parent.start, change.result.start], [change.parent.end, change.result.end]);
  }
  anchors.push([parentLines, resultLines]);
  return anchors;
}

/** The result's folds: its runs of lines that match both parents, from the marks (1-based, like foldModel). */
export function resultFolds(marks: LineMark[], resultLines: number): FoldRange[] {
  return foldRanges(
    marks.map((mark) => ({ first: mark.range.start + 1, after: mark.range.end + 1 })),
    resultLines,
  );
}

/** A result fold in a parent pane: the same lines, since they match that parent line for line. */
export function parentFold(fold: FoldRange, anchors: Anchor[]): FoldRange {
  const back = invertAnchors(anchors);
  return {
    first: Math.round(mapLine(fold.first - 1, back)) + 1,
    last: Math.round(mapLine(fold.last - 1, back)) + 1,
  };
}

/** The overview ruler's marks for a pane. */
export function rulerMarks(marks: LineMark[]): ChangeMark[] {
  return marks.map((mark) => ({ from: mark.range.start, to: mark.range.end, kind: mark.type }));
}

/** "15 changes, 1 conflict": the result's changes, counting conflicts apart. */
export function changeSummary(marks: LineMark[]): string {
  const conflicts = marks.filter((mark) => mark.type === "conflict").length;
  const changes = marks.length;
  const changeText = changes === 1 ? "1 change" : `${changes} changes`;
  if (conflicts === 0) {
    return changeText;
  }
  return `${changeText}, ${conflicts === 1 ? "1 conflict" : `${conflicts} conflicts`}`;
}
