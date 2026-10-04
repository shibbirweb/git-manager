// Drag and drop in the Files panel: where a drop lands, whether it may, and the small
// numbers of the gesture (start distance, auto-scroll speed, Finder drop positions).

import type { MenuPlatform } from "$lib/menu/menuIds";
import { isInside, parentOf } from "$lib/stores/workspacePaths";

/** The pointer must move this far (CSS px) before a press on a row becomes a drag. */
export const DRAG_THRESHOLD_PX = 4;
/** A press becomes a drag once the pointer is `DRAG_THRESHOLD_PX` away from where it went down. */
export function pastDragThreshold(start: { x: number; y: number }, point: { x: number; y: number }): boolean {
  return Math.hypot(point.x - start.x, point.y - start.y) >= DRAG_THRESHOLD_PX;
}

/** Hovering a closed folder this long during a drag opens it. */
export const HOVER_EXPAND_MS = 600;
/** Pointer distance from the list's top or bottom edge that scrolls it during a drag. */
export const AUTO_SCROLL_EDGE_PX = 28;
const AUTO_SCROLL_MAX_STEP_PX = 14;

export type DropMode = "move" | "copy";

/** Whether a drop may happen: "noop" is a move into the folder the items are already in. */
export type DropCheck = "ok" | "noop" | "intoItself";

export interface DropRow {
  path: string;
  isDir: boolean;
}

/** The folder a drop on `row` goes into: the folder itself, a file's folder, or `fallbackRoot` off the rows. */
export function dropFolder(row: DropRow | null, fallbackRoot: string | null): string | null {
  if (!row) {
    return fallbackRoot;
  }
  return row.isDir ? row.path : parentOf(row.path);
}

export function checkDrop(sourcePaths: string[], targetDir: string, mode: DropMode): DropCheck {
  if (sourcePaths.length === 0) {
    return "noop";
  }
  // A folder cannot go into itself or a folder inside it.
  if (sourcePaths.some((sourcePath) => isInside(sourcePath, targetDir))) {
    return "intoItself";
  }
  if (mode === "move" && sourcePaths.every((sourcePath) => parentOf(sourcePath) === targetDir)) {
    return "noop";
  }
  return "ok";
}

/**
 * Pixels to scroll this frame: negative near the top edge, positive near the bottom, faster
 * closer to it and fastest just past it. Far outside the list it stops.
 */
export function autoScrollStep(pointerY: number, top: number, bottom: number): number {
  if (pointerY < top - AUTO_SCROLL_EDGE_PX || pointerY > bottom + AUTO_SCROLL_EDGE_PX) {
    return 0;
  }
  if (pointerY < top + AUTO_SCROLL_EDGE_PX) {
    const depth = Math.min(AUTO_SCROLL_EDGE_PX, top + AUTO_SCROLL_EDGE_PX - pointerY);
    return -Math.ceil((depth / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_STEP_PX);
  }
  if (pointerY > bottom - AUTO_SCROLL_EDGE_PX) {
    const depth = Math.min(AUTO_SCROLL_EDGE_PX, pointerY - (bottom - AUTO_SCROLL_EDGE_PX));
    return Math.ceil((depth / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_STEP_PX);
  }
  return 0;
}

/** The text that follows the pointer: "Move cart.ts", "Copy 3 items". */
export function dragLabel(names: string[], mode: DropMode): string {
  const what = names.length === 1 ? names[0] : `${names.length} items`;
  return `${mode === "copy" ? "Copy" : "Move"} ${what}`;
}

/**
 * A Finder drop position in CSS pixels. Tauri types it as physical pixels, but on macOS wry
 * reports the window's own coordinates, which are already points (CSS pixels at zoom 1);
 * Windows and Linux report device pixels.
 */
export function dropPointToCss(position: { x: number; y: number }, scale: number, platform: MenuPlatform): { x: number; y: number } {
  const factor = platform === "macos" || !(scale > 0) ? 1 : scale;
  return { x: position.x / factor, y: position.y / factor };
}
