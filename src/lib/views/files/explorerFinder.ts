// Files dragged in from the Finder (or Explorer): Tauri reports the drag to the window, and the Files panel's Tree
// shows where they would land, opens hovered folders and scrolls like a row drag. A drop copies them in. A
// terminal takes drops over it (TerminalHost), so the same drop never lands twice.
import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
import { platformFromUserAgent } from "$lib/menu/menuSpec";
import { fromNativePath } from "$lib/stores/workspacePaths";
import { terminalKeyAt } from "$lib/terminal/dropPaths";
import { dropPointToCss } from "./dragDrop";

const PLATFORM = platformFromUserAgent(navigator.userAgent);

export interface OutsideDropTarget {
  dragFromOutside: (x: number, y: number, ids: string[]) => void;
  endOutsideDrag: () => string | null | undefined;
  cancelOutsideDrag: () => void;
}

/** Follows the window's file drags into `tree`; `drop` copies the paths into the folder (null: the top level). */
export function followFinderDrags(
  tree: () => OutsideDropTarget | null,
  drop: (paths: string[], target: string | null) => void,
): () => void {
  /** Paths of the drag over the window, from its "enter" event; "over" events carry none. */
  let paths: string[] = [];
  const onEvent = (event: DragDropEvent): void => {
    const target = tree();
    if (!target) {
      return;
    }
    if (event.type === "leave") {
      paths = [];
      target.cancelOutsideDrag();
      return;
    }
    if (event.type === "enter") {
      paths = event.paths.map((nativePath) => fromNativePath(nativePath));
    }
    const point = dropPointToCss(event.position, window.devicePixelRatio, PLATFORM);
    if (terminalKeyAt(document.elementFromPoint(point.x, point.y)) !== null) {
      if (event.type === "drop") {
        paths = [];
      }
      target.cancelOutsideDrag();
      return;
    }
    if (event.type === "drop") {
      const dropped = event.paths.map((nativePath) => fromNativePath(nativePath));
      // The last position counts: the drop event's own point lands on the same row.
      target.dragFromOutside(point.x, point.y, dropped);
      const into = target.endOutsideDrag();
      paths = [];
      if (into !== undefined && dropped.length > 0) {
        drop(dropped, into);
      }
      return;
    }
    if (paths.length > 0) {
      target.dragFromOutside(point.x, point.y, paths);
    }
  };
  let unlisten: (() => void) | null = null;
  let disposed = false;
  try {
    void getCurrentWebview()
      .onDragDropEvent((event) => onEvent(event.payload))
      .then((off) => {
        if (disposed) {
          off();
        } else {
          unlisten = off;
        }
      })
      .catch(() => undefined);
  } catch {
    // Not inside Tauri (the screenshot bridge): there are no Finder drops to take.
  }
  return () => {
    disposed = true;
    unlisten?.();
    tree()?.cancelOutsideDrag();
  };
}
