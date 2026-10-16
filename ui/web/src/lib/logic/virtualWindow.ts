// Which rows of a long list to draw: only those in view plus a few above and below (overscan), the way the app's
// Files panel and log stay fast with 100,000 rows.

export interface RowRange {
  /** First row to draw. */
  first: number;
  /** One past the last row to draw. */
  last: number;
}

export function visibleRows(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan = 8,
): RowRange {
  if (count <= 0 || rowHeight <= 0) {
    return { first: 0, last: 0 };
  }
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { first, last: Math.max(first, last) };
}

/** The scrollTop that brings row `index` fully into view, or null when it already is. */
export function scrollToShow(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
): number | null {
  const top = index * rowHeight;
  if (top < scrollTop) {
    return top;
  }
  if (top + rowHeight > scrollTop + viewportHeight) {
    return top + rowHeight - viewportHeight;
  }
  return null;
}

/** The scrollTop that puts row `index` in the middle of the view when it is not fully in view, or null. */
export function scrollToCenter(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
): number | null {
  if (scrollToShow(index, rowHeight, scrollTop, viewportHeight) === null) {
    return null;
  }
  return Math.max(0, index * rowHeight - (viewportHeight - rowHeight) / 2);
}
