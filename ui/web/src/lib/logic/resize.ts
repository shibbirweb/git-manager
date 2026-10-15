// Sizes while resizing a panel with ResizeHandle: dragging and arrow keys, kept between min and max. A panel on the
// left grows when dragging right; panels on the right or at the bottom grow towards the start.

/** Where the panel is, relative to its handle: top is a pane above it, such as a list over its details. */
export type PanelSide = "left" | "right" | "top" | "bottom";

export function clampSize(size: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, size)));
}

export function draggedSize(side: PanelSide, startSize: number, delta: number, min: number, max: number): number {
  return clampSize(side === "left" || side === "top" ? startSize + delta : startSize - delta, min, max);
}

/** The size after an arrow key (10px, 40px with Shift), or null for other keys. */
export function keyedSize(side: PanelSide, key: string, shift: boolean, size: number, min: number, max: number) {
  const keys: Record<PanelSide, [string, string]> = {
    left: ["ArrowRight", "ArrowLeft"],
    right: ["ArrowLeft", "ArrowRight"],
    top: ["ArrowDown", "ArrowUp"],
    bottom: ["ArrowUp", "ArrowDown"],
  };
  const [grow, shrink] = keys[side];
  if (key !== grow && key !== shrink) {
    return null;
  }
  const step = shift ? 40 : 10;
  return clampSize(size + (key === grow ? step : -step), min, max);
}
