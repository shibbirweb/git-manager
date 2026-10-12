// Moving a dialog by its title: the new offset from its centered place, kept so part of it (and its title) stays
// on screen and it can always be grabbed again.

export interface MoveStart {
  /** The pointer where the drag began. */
  pointerX: number;
  pointerY: number;
  /** The offset when the drag began. */
  x: number;
  y: number;
  /** The dialog's box when the drag began. */
  left: number;
  top: number;
  width: number;
}

/** The offset for the pointer at (pointerX, pointerY) in a viewport of the given size. */
export function movedOffset(
  start: MoveStart,
  pointerX: number,
  pointerY: number,
  viewport: { width: number; height: number },
  keepVisible: number,
): { x: number; y: number } {
  const dx = pointerX - start.pointerX;
  const dy = pointerY - start.pointerY;
  const minDx = keepVisible - start.left - start.width;
  const maxDx = viewport.width - keepVisible - start.left;
  const minDy = -start.top;
  const maxDy = viewport.height - keepVisible - start.top;
  return {
    x: start.x + Math.min(maxDx, Math.max(minDx, dx)),
    y: start.y + Math.min(maxDy, Math.max(minDy, dy)),
  };
}
