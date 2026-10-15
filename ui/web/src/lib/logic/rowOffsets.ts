// A long list whose rows differ in height, like the Git Console's entries that open to show their output: each
// row's top comes from the heights measured so far, and an estimate stands in for rows never drawn.
import { visibleRows, type RowRange } from "./virtualWindow";

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

/** The scrollTop that puts the middle of a row from `top` to `bottom` in the middle of the view (never below 0). */
export function scrollToCenterBox(top: number, bottom: number, viewportHeight: number): number {
  return Math.max(0, Math.round((top + bottom - viewportHeight) / 2));
}

export interface ListWindow extends RowRange {
  /** The rows' full height in CSS, or null when every row is drawn and the list sizes itself. */
  total: string | null;
}

/**
 * The rows a list draws: every row, or with fixed `rowPx` rows (`offsets` null) or measured `offsets`, the ones in
 * view of a box `viewportHeight` tall scrolled to `scrollTop`.
 */
export function listWindow(
  count: number,
  rowPx: number | null,
  offsets: number[] | null,
  scrollTop: number,
  viewportHeight: number,
): ListWindow {
  if (rowPx === null) {
    return { first: 0, last: count, total: null };
  }
  const range = offsets
    ? visibleByOffsets(offsets, scrollTop, viewportHeight)
    : visibleRows(scrollTop, viewportHeight, rowPx, count);
  return { ...range, total: `${offsets ? offsets[count] : count * rowPx}px` };
}
