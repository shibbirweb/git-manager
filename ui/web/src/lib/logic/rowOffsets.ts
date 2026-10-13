// A long list whose rows differ in height, like the Git Console's entries that open to show their output: each
// row's top comes from the heights measured so far, and an estimate stands in for rows never drawn.
import type { RowRange } from "./virtualWindow";

/** Each row's top, then the total height as the last entry (length count + 1). */
export function rowOffsets(count: number, heightOf: (index: number) => number): number[] {
  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let index = 0; index < count; index++) {
    offsets[index + 1] = offsets[index] + heightOf(index);
  }
  return offsets;
}

/** The first row whose bottom is below `y`, by binary search. */
function rowAt(offsets: number[], y: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (offsets[middle + 1] <= y) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return Math.max(0, low);
}

/** The rows to draw: those in view, plus `overscan` above and below. */
export function visibleByOffsets(offsets: number[], scrollTop: number, viewportHeight: number, overscan = 8): RowRange {
  const count = offsets.length - 1;
  if (count <= 0) {
    return { first: 0, last: 0 };
  }
  const first = Math.max(0, rowAt(offsets, scrollTop) - overscan);
  const last = Math.min(count, rowAt(offsets, scrollTop + viewportHeight) + 1 + overscan);
  return { first, last: Math.max(first, last) };
}

/** The scrollTop that brings a row from `top` to `bottom` into view, or null when it already is. */
export function scrollToShowBox(top: number, bottom: number, scrollTop: number, viewportHeight: number): number | null {
  if (top < scrollTop) {
    return top;
  }
  if (bottom > scrollTop + viewportHeight) {
    return Math.min(top, bottom - viewportHeight);
  }
  return null;
}
