// Where a dragged item lands among items in a row (tabs) or a column (rebase steps): the index whose slot the
// pointer is over, from the items' centers. Dragging by less than DRAG_THRESHOLD px is a click, not a drag.

export const DRAG_THRESHOLD = 4;

/** The index the item from `from` moves to when the pointer is at `position` along the axis. */
export function dropIndex(centers: number[], position: number, from: number): number {
  if (!centers.length) {
    return from;
  }
  let index = centers.findIndex((center) => position < center);
  if (index < 0) {
    index = centers.length;
  }
  // Moving right or down, the item leaves its own slot, so slots after it shift back by one.
  return index > from ? index - 1 : index;
}

export function movedItems<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}
