// The 2-way diff's changes from the backend's line hunks (imara-diff, like git). CodeMirror's own
// diff gives up past its scan limit on large files and merges every edit into one giant change;
// here it only refines each hunk to characters, so the cost and the result follow the real edits.

import { Change, diff } from "@codemirror/merge";
import type { LineHunk } from "$lib/types";

/** CodeMirror's limit for the MergeView, kept for the character diff inside each hunk. */
export const SCAN_LIMIT = 500;

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let at = text.indexOf("\n"); at >= 0; at = text.indexOf("\n", at + 1)) {
    starts.push(at + 1);
  }
  return starts;
}

/** Character ranges of each hunk, or null when the hunks do not fit the texts. */
export function hunkRanges(a: string, b: string, hunks: readonly LineHunk[]): [number, number, number, number][] | null {
  const startsA = lineStarts(a);
  const startsB = lineStarts(b);
  const ranges: [number, number, number, number][] = [];
  let lastA = 0;
  let lastB = 0;
  let changedA = 0;
  let changedB = 0;
  for (const [oldStart, oldEnd, newStart, newEnd] of hunks) {
    const valid =
      oldStart <= oldEnd &&
      newStart <= newEnd &&
      oldEnd <= startsA.length &&
      newEnd <= startsB.length &&
      (oldStart < oldEnd || newStart < newEnd) &&
      (oldEnd === startsA.length) === (newEnd === startsB.length);
    if (!valid) {
      return null;
    }
    let fromA = oldStart < startsA.length ? startsA[oldStart] : a.length;
    let fromB = newStart < startsB.length ? startsB[newStart] : b.length;
    // Lines added or removed after the last line of one side: the change starts at the
    // newline ending the line before, which that side does not have.
    if (oldStart === startsA.length && newStart > 0) {
      fromB = startsB[newStart] - 1;
    } else if (newStart === startsB.length && oldStart > 0) {
      fromA = startsA[oldStart] - 1;
    }
    const toA = oldEnd < startsA.length ? startsA[oldEnd] : a.length;
    const toB = newEnd < startsB.length ? startsB[newEnd] : b.length;
    if (fromA < lastA || fromB < lastB || toA < fromA || toB < fromB) {
      return null;
    }
    ranges.push([fromA, toA, fromB, toB]);
    changedA += toA - fromA;
    changedB += toB - fromB;
    lastA = toA;
    lastB = toB;
  }
  // The text outside the hunks is the same on both sides, so it has the same length.
  return a.length - changedA === b.length - changedB ? ranges : null;
}

/** Character changes: CodeMirror's diff inside each hunk, null when the hunks do not fit. */
export function changesFromHunks(a: string, b: string, hunks: readonly LineHunk[]): Change[] | null {
  const ranges = hunkRanges(a, b, hunks);
  if (!ranges) {
    return null;
  }
  const changes: Change[] = [];
  for (const [fromA, toA, fromB, toB] of ranges) {
    for (const change of diff(a.slice(fromA, toA), b.slice(fromB, toB), { scanLimit: SCAN_LIMIT })) {
      changes.push(new Change(change.fromA + fromA, change.toA + fromA, change.fromB + fromB, change.toB + fromB));
    }
  }
  return changes;
}

/**
 * A diff function for MergeView's `diffConfig.override`: the backend's hunks for the two texts
 * they were computed for; anything else (ranges re-diffed after a chunk is staged, hunks that
 * do not fit) falls back to CodeMirror's own diff.
 */
export function hunkDiff(original: string, modified: string, hunks: readonly LineHunk[]): (a: string, b: string) => readonly Change[] {
  return (a, b) => {
    if (a.length === original.length && b.length === modified.length && a === original && b === modified) {
      const changes = changesFromHunks(a, b, hunks);
      if (changes) {
        return changes;
      }
    }
    return diff(a, b, { scanLimit: SCAN_LIMIT });
  };
}
