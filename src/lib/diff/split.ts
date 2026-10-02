// The width split between the two sides of a side-by-side diff.

export const DIFF_SPLIT_RANGE = [0.15, 0.85] as const;
export const DEFAULT_DIFF_SPLIT = 0.5;

export function clampDiffSplit(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return DEFAULT_DIFF_SPLIT;
  }
  return Math.min(DIFF_SPLIT_RANGE[1], Math.max(DIFF_SPLIT_RANGE[0], ratio));
}

/**
 * The left side's share for a pointer at `pointerX`, given where the editors
 * start, their total width, and the width of the change arrows between them
 * (which never grow or shrink).
 */
export function splitFromPointer(pointerX: number, editorsLeft: number, editorsWidth: number, gutterWidth: number): number {
  const shared = editorsWidth - gutterWidth;
  if (shared <= 0) {
    return DEFAULT_DIFF_SPLIT;
  }
  return clampDiffSplit((pointerX - editorsLeft) / shared);
}
