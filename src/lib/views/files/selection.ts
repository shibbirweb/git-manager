// Multi-selection in the Files panel, like VS Code's explorer: a click selects one row,
// Cmd-click (Ctrl-click elsewhere) toggles a row, Shift-click selects the range from the
// anchor, and Shift+Up / Shift+Down extend it. `order` is always the visible rows, top down.

import { movedPath, type PathMove } from "$lib/stores/workspacePaths";

export interface TreeSelection {
  /** Selected absolute paths. */
  paths: ReadonlySet<string>;
  /** Where a Shift range starts. */
  anchor: string | null;
  /** The row the keyboard is on. */
  focus: string | null;
}

export const EMPTY_SELECTION: TreeSelection = { paths: new Set(), anchor: null, focus: null };

export function selectOnly(path: string | null): TreeSelection {
  if (path === null) {
    return EMPTY_SELECTION;
  }
  return { paths: new Set([path]), anchor: path, focus: path };
}

/** Selects several rows at once, e.g. the copies a paste made; the last one gets the focus. */
export function selectAll(paths: string[]): TreeSelection {
  if (paths.length === 0) {
    return EMPTY_SELECTION;
  }
  return { paths: new Set(paths), anchor: paths[0], focus: paths[paths.length - 1] };
}

/** Cmd-click: adds or removes one row; it becomes the anchor of the next Shift-click. */
export function toggleSelected(selection: TreeSelection, path: string): TreeSelection {
  const paths = new Set(selection.paths);
  if (paths.has(path)) {
    paths.delete(path);
  } else {
    paths.add(path);
  }
  return { paths, anchor: path, focus: path };
}

function rangeOf(order: string[], from: number, to: number): Set<string> {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return new Set(order.slice(start, end + 1));
}

/** Shift-click: the rows from the anchor to `path` replace the selection; the anchor stays. */
export function selectRange(selection: TreeSelection, order: string[], path: string): TreeSelection {
  const target = order.indexOf(path);
  if (target < 0) {
    return selection;
  }
  const anchorIndex = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
  if (anchorIndex < 0) {
    return selectOnly(path);
  }
  return { paths: rangeOf(order, anchorIndex, target), anchor: selection.anchor, focus: path };
}

/** Shift+Up (-1) / Shift+Down (1): moves the focus one row and selects from the anchor to it. */
export function extendSelection(selection: TreeSelection, order: string[], step: 1 | -1): TreeSelection {
  if (order.length === 0) {
    return selection;
  }
  const focusIndex = selection.focus === null ? -1 : order.indexOf(selection.focus);
  if (focusIndex < 0) {
    return selectOnly(order[step === 1 ? 0 : order.length - 1]);
  }
  const next = Math.min(order.length - 1, Math.max(0, focusIndex + step));
  const anchorIndex = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
  const from = anchorIndex < 0 ? focusIndex : anchorIndex;
  return { paths: rangeOf(order, from, next), anchor: order[from], focus: order[next] };
}

/** The selected rows that are visible, top down. Rows hidden in a collapsed folder are left out. */
export function selectedInOrder(selection: TreeSelection, order: string[]): string[] {
  return order.filter((path) => selection.paths.has(path));
}

/**
 * Whether one of `folders` holds `path` (strictly: `path` itself does not count), by the rule of `isInside`.
 * Every folder that holds a path ends right before one of its slashes, with or without that slash, so looking
 * those prefixes up is enough: no pass over all the folders.
 */
function insideAnyOf(folders: ReadonlySet<string>, path: string): boolean {
  for (let index = path.indexOf("/"); index >= 0; index = path.indexOf("/", index + 1)) {
    if (folders.has(path.slice(0, index))) {
      return true;
    }
    const withSlash = path.slice(0, index + 1);
    if (withSlash !== path && folders.has(withSlash)) {
      return true;
    }
  }
  return false;
}

/** Drops paths inside another listed folder: moving or trashing the folder takes them along. */
export function topLevel(paths: string[]): string[] {
  const all = new Set(paths);
  return paths.filter((path) => !insideAnyOf(all, path));
}

/** The selection after renames or moves, following each path to its new place. */
export function retargetSelection(selection: TreeSelection, moves: PathMove[]): TreeSelection {
  const follow = (path: string | null) => (path === null ? null : movedPath(path, moves));
  return {
    paths: new Set([...selection.paths].map((path) => movedPath(path, moves))),
    anchor: follow(selection.anchor),
    focus: follow(selection.focus),
  };
}

/**
 * The row to select after `removed` went to the Trash: the first remaining row below the
 * last removed one, else the nearest one above, else null.
 */
export function rowAfterRemoval(order: string[], removed: string[]): string | null {
  const removedSet = new Set(removed);
  const gone = (path: string) => removedSet.has(path) || insideAnyOf(removedSet, path);
  let last = -1;
  order.forEach((path, index) => {
    if (gone(path)) {
      last = index;
    }
  });
  if (last < 0) {
    return null;
  }
  for (let index = last + 1; index < order.length; index++) {
    if (!gone(order[index])) {
      return order[index];
    }
  }
  for (let index = last - 1; index >= 0; index--) {
    if (!gone(order[index])) {
      return order[index];
    }
  }
  return null;
}
