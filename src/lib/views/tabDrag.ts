// Dragging a tab in an editor group's strip: the other tabs slide aside
// while the dragged one follows the pointer. The gap a drop lands in comes from where the
// tabs were when the drag started, so the sliding does not feed back into the target.

/** A tab's box when the drag started, in the strip's scrolled content coordinates (CSS px). */
export interface TabBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The gap (0 before the first tab, `boxes.length` after the last) for a pointer at `x`, `y`.
 * With `wrapped` rows the pointer's row counts first (the nearest one when it is between or
 * outside rows); in a single row only `x` matters. Within the row a tab whose middle the
 * pointer passed lets the dragged tab in after it.
 */
export function dropGap(boxes: readonly TabBox[], x: number, y: number, wrapped: boolean): number {
  if (boxes.length === 0) {
    return 0;
  }
  let row = boxes.map((_, index) => index);
  if (wrapped) {
    const centre = (box: TabBox) => (box.top + box.bottom) / 2;
    let nearest = 0;
    for (let index = 1; index < boxes.length; index += 1) {
      if (Math.abs(centre(boxes[index]) - y) < Math.abs(centre(boxes[nearest]) - y)) {
        nearest = index;
      }
    }
    const rowTop = boxes[nearest].top;
    row = row.filter((index) => boxes[index].top === rowTop);
  }
  for (const index of row) {
    const box = boxes[index];
    if (x < (box.left + box.right) / 2) {
      return index;
    }
  }
  return row[row.length - 1] + 1;
}

/** Sideways scroll step for a pointer near the strip's left or right edge while dragging. */
export function edgeScrollStep(x: number, left: number, right: number): number {
  const edge = 24;
  const maxStep = 12;
  if (x < left + edge) {
    return -Math.ceil((Math.min(edge, left + edge - x) / edge) * maxStep);
  }
  if (x > right - edge) {
    return Math.ceil((Math.min(edge, x - (right - edge)) / edge) * maxStep);
  }
  return 0;
}
