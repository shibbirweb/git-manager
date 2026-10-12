// The state of a movable dialog: its offset from the centered place and the drag in progress. Dialog.svelte wires
// the title's pointer events to it.
import { componentTokens } from "../styles/tokens";
import { movedOffset, type MoveStart } from "./dialogMove";

export class DialogMover {
  offset = $state({ x: 0, y: 0 });
  moving: MoveStart | null = $state(null);

  /** The CSS transform for the offset, or null when centered. */
  get transform(): string | null {
    return this.offset.x || this.offset.y ? `translate(${this.offset.x}px, ${this.offset.y}px)` : null;
  }

  start(event: PointerEvent, dialog: HTMLElement): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const { left, top, width } = dialog.getBoundingClientRect();
    const { x, y } = this.offset;
    this.moving = { pointerX: event.clientX, pointerY: event.clientY, x, y, left, top, width };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  move(event: PointerEvent): void {
    if (this.moving) {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const keep = componentTokens.dialog.keepVisible;
      this.offset = movedOffset(this.moving, event.clientX, event.clientY, viewport, keep);
    }
  }

  end(): void {
    this.moving = null;
  }

  center(): void {
    this.offset = { x: 0, y: 0 };
  }
}
