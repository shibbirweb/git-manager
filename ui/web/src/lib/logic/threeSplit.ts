// The widths of three side-by-side panes (a 3-way merge or diff) as two boundaries, 0 to 1, of the width the panes
// share: the left pane ends at the first and the right pane starts at the second. Every pane keeps a minimum share,
// so none disappears.

export type ThreeSplit = readonly [number, number];

export const MIN_PANE_SHARE = 0.15;
export const EVEN_THREE_SPLIT: ThreeSplit = [1 / 3, 2 / 3];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The split after moving one boundary (0 the left, 1 the right) to `ratio`; the other boundary stays put. */
export function moveThreeSplit(split: ThreeSplit, boundary: 0 | 1, ratio: number): ThreeSplit {
  if (!Number.isFinite(ratio)) {
    return split;
  }
  if (boundary === 0) {
    return [clamp(ratio, MIN_PANE_SHARE, split[1] - MIN_PANE_SHARE), split[1]];
  }
  return [split[0], clamp(ratio, split[0] + MIN_PANE_SHARE, 1 - MIN_PANE_SHARE)];
}

/** A saved split, or the even split when it is not two numbers that leave every pane its minimum share. */
export function readThreeSplit(value: unknown): ThreeSplit {
  if (!Array.isArray(value) || value.length !== 2) {
    return EVEN_THREE_SPLIT;
  }
  const [first, second] = value as unknown[];
  if (typeof first !== "number" || typeof second !== "number" || !Number.isFinite(first + second)) {
    return EVEN_THREE_SPLIT;
  }
  // A small rounding error in a saved value is fine; the check leaves room for it.
  const slack = 1e-9;
  const fits =
    first >= MIN_PANE_SHARE - slack && second - first >= MIN_PANE_SHARE - slack && 1 - second >= MIN_PANE_SHARE - slack;
  return fits ? [first, second] : EVEN_THREE_SPLIT;
}
