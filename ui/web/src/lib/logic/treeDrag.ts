// Dragging rows of a Tree onto folders, like the app's Files panel (src/lib/views/files/dragDrop.ts). The drag uses
// pointer events, not HTML5 drag and drop: Tauri's window answers every native drag itself (to report Finder
// files), so HTML5 drop events never reach the page. Option (Alt) copies instead of moving.
import type { TreeNode } from "./treeModel";

export type DropMode = "move" | "copy";

/** Hovering a closed folder this long during a drag opens it. */
export const HOVER_OPEN_MS = 600;
/** Pointer distance from the list's top or bottom edge that scrolls it during a drag, and the fastest step. */
export const AUTO_SCROLL_EDGE = 28;
export const AUTO_SCROLL_MAX_STEP = 14;

/** Each node's parent id (null at the top), for every node, open or not. */
export function treeParents(nodes: readonly TreeNode[]): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  const walk = (children: readonly TreeNode[], parent: string | null) => {
    for (const node of children) {
      parents.set(node.id, parent);
      if (node.children) {
        walk(node.children, node.id);
      }
    }
  };
  walk(nodes, null);
  return parents;
}

export interface DropHit {
  /** The row under the pointer, or null over the list's empty part. */
  rowId: string | null;
  /** Whether the pointer is over the tree at all. */
  inside: boolean;
}

/**
 * The folder a drop goes into: the folder under the pointer, a file's folder, or null for the top level. Undefined
 * when there is nowhere to drop: outside the tree, into a dragged folder or one inside it, or a move to where the
 * rows already are.
 */
export function treeDropTarget(
  hit: DropHit,
  sourceIds: readonly string[],
  mode: DropMode,
  parents: ReadonlyMap<string, string | null>,
  isFolder: (id: string) => boolean,
): string | null | undefined {
  if (!hit.inside || sourceIds.length === 0) {
    return undefined;
  }
  const folder = hit.rowId === null ? null : isFolder(hit.rowId) ? hit.rowId : (parents.get(hit.rowId) ?? null);
  for (let current = folder; current !== null; current = parents.get(current) ?? null) {
    if (sourceIds.includes(current)) {
      return undefined;
    }
  }
  if (mode === "move" && sourceIds.every((id) => (parents.get(id) ?? null) === folder)) {
    return undefined;
  }
  return folder;
}

/** Pixels to scroll this frame: up near the top edge, down near the bottom, faster closer to it; far off, none. */
export function treeScrollStep(pointerY: number, top: number, bottom: number): number {
  if (pointerY < top - AUTO_SCROLL_EDGE || pointerY > bottom + AUTO_SCROLL_EDGE) {
    return 0;
  }
  const speed = (depth: number) =>
    Math.ceil((Math.min(AUTO_SCROLL_EDGE, depth) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_STEP);
  if (pointerY < top + AUTO_SCROLL_EDGE) {
    return -speed(top + AUTO_SCROLL_EDGE - pointerY);
  }
  if (pointerY > bottom - AUTO_SCROLL_EDGE) {
    return speed(pointerY - (bottom - AUTO_SCROLL_EDGE));
  }
  return 0;
}

/** The text that follows the pointer: "Move cart.ts", "Copy 3 items". */
export function dragText(labels: readonly string[], mode: DropMode): string {
  const what = labels.length === 1 ? labels[0] : `${labels.length} items`;
  return `${mode === "copy" ? "Copy" : "Move"} ${what}`;
}
