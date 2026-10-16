// Drag and drop in the Files panel: whether a drop may happen, and where a Finder drop is. The gesture itself
// (start distance, target, hover-open, auto-scroll) is the UI library's Tree (logic/treeDrag.ts).

import type { MenuPlatform } from "$lib/menu/menuIds";
import { isInside, parentOf } from "$lib/stores/workspacePaths";

export type DropMode = "move" | "copy";

/** Whether a drop may happen: "noop" is a move into the folder the items are already in. */
export type DropCheck = "ok" | "noop" | "intoItself";

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
 * A Finder drop position in CSS pixels. Tauri types it as physical pixels, but on macOS wry
 * reports the window's own coordinates, which are already points (CSS pixels at zoom 1);
 * Windows and Linux report device pixels.
 */
export function dropPointToCss(
  position: { x: number; y: number },
  scale: number,
  platform: MenuPlatform,
): { x: number; y: number } {
  const factor = platform === "macos" || !(scale > 0) ? 1 : scale;
  return { x: position.x / factor, y: position.y / factor };
}
