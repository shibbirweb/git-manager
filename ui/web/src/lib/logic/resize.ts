// Sizes while resizing a panel with ResizeHandle: dragging and arrow keys, kept between min and max. A panel on the
// left grows when dragging right; panels on the right or at the bottom grow towards the start.

export type PanelSide = "left" | "right" | "bottom";

export function clampSize(size: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, size)));
}

export function draggedSize(side: PanelSide, startSize: number, delta: number, min: number, max: number): number {
  return clampSize(side === "left" ? startSize + delta : startSize - delta, min, max);
}

/** The size after an arrow key (10px, 40px with Shift), or null for other keys. */
export function keyedSize(side: PanelSide, key: string, shift: boolean, size: number, min: number, max: number) {
  const grow = side === "left" ? "ArrowRight" : side === "right" ? "ArrowLeft" : "ArrowUp";
  const shrink = side === "left" ? "ArrowLeft" : side === "right" ? "ArrowRight" : "ArrowDown";
  if (key !== grow && key !== shrink) {
    return null;
  }
  const step = shift ? 40 : 10;
  return clampSize(size + (key === grow ? step : -step), min, max);
}
