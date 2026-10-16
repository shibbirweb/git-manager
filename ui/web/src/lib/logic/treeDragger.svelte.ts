// The pointer drag of a Tree: a press on a row becomes a drag past DRAG_THRESHOLD, the target follows the pointer
// (treeDrag.ts decides where a drop may land), a closed folder under the pointer opens after HOVER_OPEN_MS, the list
// scrolls near its edges, Option switches to copy and Escape cancels. Window listeners live only while a press or
// a drag does. A drag from outside the tree (files from the Finder) gets the same target, hover and scrolling.
import { DRAG_THRESHOLD } from "./reorder";
import { HOVER_OPEN_MS, treeScrollStep, type DropHit, type DropMode } from "./treeDrag";

export interface TreeDragState {
  ids: string[];
  x: number;
  y: number;
  mode: DropMode;
  /** The folder a drop goes into, null for the top level, undefined for nowhere. */
  target: string | null | undefined;
  /** Comes from outside the tree: the system draws its own image, so there is no ghost. */
  outside?: boolean;
}

export interface TreeDragHost {
  /** The tree's own element, to tell whether the pointer is over it. */
  root: () => HTMLElement | null;
  /** The element that scrolls the rows. */
  scroller: () => HTMLElement | null;
  /** The ids a drag from this row carries: the selection when the row is in it. */
  idsFor: (id: string) => string[];
  target: (hit: DropHit, ids: string[], mode: DropMode) => string | null | undefined;
  /** A folder that is closed now, to open while hovered. */
  isClosedFolder: (id: string) => boolean;
  open: (id: string) => void;
  drop: (ids: string[], target: string | null, mode: DropMode) => void;
}

export class TreeDragger {
  drag = $state<TreeDragState | null>(null);
  #press: { id: string; x: number; y: number } | null = null;
  #hoverId: string | null = null;
  #hoverTimer: ReturnType<typeof setTimeout> | undefined;
  #frame = 0;
  #host: TreeDragHost;

  constructor(host: TreeDragHost) {
    this.#host = host;
  }

  /** A press on a row; plain left presses only, since Cmd and Shift clicks select. */
  press(event: PointerEvent, id: string): void {
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || this.#press) {
      return;
    }
    this.#press = { id, x: event.clientX, y: event.clientY };
    window.addEventListener("pointermove", this.#move);
    window.addEventListener("pointerup", this.#up);
    window.addEventListener("pointercancel", this.cancel);
    window.addEventListener("keydown", this.#key, true);
    window.addEventListener("keyup", this.#key, true);
  }

  cancel = (): void => {
    this.#press = null;
    this.drag = null;
    this.#hover(null);
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    window.removeEventListener("pointermove", this.#move);
    window.removeEventListener("pointerup", this.#up);
    window.removeEventListener("pointercancel", this.cancel);
    window.removeEventListener("keydown", this.#key, true);
    window.removeEventListener("keyup", this.#key, true);
  };

  /** A drag from outside the tree is at (x, y), carrying `ids` (such as file paths); it always copies. */
  outside(x: number, y: number, ids: string[]): void {
    if (this.drag && !this.drag.outside) {
      return;
    }
    if (!this.drag) {
      this.drag = { ids, x, y, mode: "copy", target: undefined, outside: true };
      this.#frame = requestAnimationFrame(this.#scroll);
    } else {
      this.drag = { ...this.drag, ids };
    }
    this.#follow(x, y, "copy");
  }

  /** The drag from outside ends here: where it lands (undefined for nowhere); the app copies the files in. */
  endOutside(): string | null | undefined {
    const drag = this.drag;
    if (!drag?.outside) {
      return undefined;
    }
    this.cancel();
    return drag.target;
  }

  #move = (event: PointerEvent): void => {
    const press = this.#press;
    if (!press) {
      return;
    }
    if (!this.drag) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= DRAG_THRESHOLD) {
        return;
      }
      this.drag = { ids: this.#host.idsFor(press.id), x: 0, y: 0, mode: "move", target: undefined };
      this.#frame = requestAnimationFrame(this.#scroll);
    }
    this.#follow(event.clientX, event.clientY, event.altKey ? "copy" : "move");
  };

  #up = (): void => {
    const finished = this.drag;
    this.cancel();
    if (finished && finished.target !== undefined) {
      this.#host.drop(finished.ids, finished.target, finished.mode);
    }
  };

  #key = (event: KeyboardEvent): void => {
    if (!this.drag) {
      return;
    }
    if (event.key === "Escape" && event.type === "keydown") {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    } else if (event.key === "Alt") {
      this.#follow(this.drag.x, this.drag.y, event.type === "keydown" ? "copy" : "move");
    }
  };

  #follow(x: number, y: number, mode: DropMode): void {
    const drag = this.drag;
    if (!drag) {
      return;
    }
    const root = this.#host.root();
    const rect = root?.getBoundingClientRect();
    const inside = !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    const row = inside ? document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-tree-id]") : null;
    const rowId = row && root?.contains(row) ? (row.dataset.treeId ?? null) : null;
    const target = this.#host.target({ rowId, inside }, drag.ids, mode);
    this.drag = { ...drag, x, y, mode, target };
    this.#hover(rowId !== null && this.#host.isClosedFolder(rowId) ? rowId : null);
  }

  /** A closed folder under the pointer opens after a moment. */
  #hover(id: string | null): void {
    if (id === this.#hoverId) {
      return;
    }
    this.#hoverId = id;
    clearTimeout(this.#hoverTimer);
    if (id !== null) {
      this.#hoverTimer = setTimeout(() => {
        if (this.#hoverId === id && this.#host.isClosedFolder(id)) {
          this.#host.open(id);
        }
      }, HOVER_OPEN_MS);
    }
  }

  /** Every frame of a drag: scroll near the edges and keep the target under the pointer current. */
  #scroll = (): void => {
    const drag = this.drag;
    const scroller = this.#host.scroller();
    if (!drag) {
      return;
    }
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const across = drag.x >= rect.left && drag.x <= rect.right;
      const step = across ? treeScrollStep(drag.y, rect.top, rect.bottom) : 0;
      if (step !== 0) {
        scroller.scrollTop += step;
        this.#follow(drag.x, drag.y, drag.mode);
      }
    }
    this.#frame = requestAnimationFrame(this.#scroll);
  };
}
