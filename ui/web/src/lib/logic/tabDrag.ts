// Dragging a tab in a TabStrip: the other tabs slide aside while the dragged one follows the pointer, like the
// app's EditorTabs (src/lib/views/tabDrag.ts). The gap a drop lands in comes from where the tabs were when the
// drag started, so the sliding does not feed back into the target.

/** A tab's box when the drag started, in the strip's scrolled content coordinates (CSS px). */
export interface TabBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A press on a tab that may become a drag. */
export interface TabPress {
  id: string;
  from: number;
  pointerId: number;
  startX: number;
  startY: number;
}

/** A drag under way: the tabs' boxes at the start, where the tab was grabbed, the pointer, and the gap. */
export interface TabDrag extends TabPress {
  boxes: TabBox[];
  grabX: number;
  grabY: number;
  clientX: number;
  clientY: number;
  gap: number;
}

/** Turns a press into a drag, from the tabs' boxes and the press point in content coordinates. */
export function beginDrag(press: TabPress, boxes: TabBox[], start: { x: number; y: number }): TabDrag {
  const box = boxes[press.from] ?? { left: start.x, top: start.y };
  return {
    ...press,
    boxes,
    grabX: start.x - box.left,
    grabY: start.y - box.top,
    clientX: press.startX,
    clientY: press.startY,
    gap: press.from,
  };
}

/**
 * The gap (0 before the first tab, `boxes.length` after the last) for a pointer at `x`, `y`. With `wrapped` rows
 * the nearest row counts first; in a single row only `x` matters. Past a tab's middle, the drop goes after it.
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
    row = row.filter((index) => boxes[index].top === boxes[nearest].top);
  }
  for (const index of row) {
    if (x < (boxes[index].left + boxes[index].right) / 2) {
      return index;
    }
  }
  return row[row.length - 1] + 1;
}

/** The index the tab from `from` takes when dropped in `gap` (its own slot leaves the row first). */
export function gapIndex(gap: number, from: number): number {
  return gap > from ? gap - 1 : gap;
}

/** Pixels from a single row's edge where a drag scrolls the strip, and the fastest step per frame. */
export const EDGE_SCROLL_ZONE = 24;
export const EDGE_SCROLL_MAX_STEP = 12;

/** Sideways scroll step for a pointer near the strip's left or right edge while dragging. */
export function edgeScrollStep(x: number, left: number, right: number): number {
  const speed = (depth: number) =>
    Math.ceil((Math.min(EDGE_SCROLL_ZONE, depth) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_MAX_STEP);
  if (x < left + EDGE_SCROLL_ZONE) {
    return -speed(left + EDGE_SCROLL_ZONE - x);
  }
  if (x > right - EDGE_SCROLL_ZONE) {
    return speed(x - (right - EDGE_SCROLL_ZONE));
  }
  return 0;
}

/** Scroll a single row of tabs sideways with a vertical wheel; a pinch (Ctrl) or Cmd wheel is left alone. */
export function wheelScroll(event: { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean }): number {
  if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
    return 0;
  }
  return event.deltaY;
}

/** The box a strip scrolls: its place on screen and how far it is scrolled. */
export interface StripBox {
  getBoundingClientRect(): { left: number; top: number };
  scrollLeft: number;
  scrollTop: number;
}

/** A viewport point in a strip's scrolled content coordinates. */
export function contentPoint(strip: StripBox | null, clientX: number, clientY: number): { x: number; y: number } {
  const rect = strip?.getBoundingClientRect();
  return {
    x: clientX - (rect?.left ?? 0) + (strip?.scrollLeft ?? 0),
    y: clientY - (rect?.top ?? 0) + (strip?.scrollTop ?? 0),
  };
}

/** Each tab's box in the strip's content coordinates. */
export function tabBoxes(
  strip: StripBox | null,
  tabs: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } }[],
): TabBox[] {
  return tabs.map((tab) => {
    const rect = tab.getBoundingClientRect();
    const corner = contentPoint(strip, rect.left, rect.top);
    return { left: corner.x, right: corner.x + rect.width, top: corner.y, bottom: corner.y + rect.height };
  });
}
