// The state of a movable dialog: its offset from the centered place and the drag in progress. Dialog.svelte puts
// `handle` on its drag areas.
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

  /**
   * An action for a drag area (the title, Settings' content head): a press moves the dialog, a double-click
   * centers it; presses on its buttons stay theirs. `dialog` gives the dialog element once it is there.
   */
  handle = (area: HTMLElement, dialog: () => HTMLElement | null) => {
    const onControl = (event: Event) => (event.target as Element | null)?.closest("button, input, a") !== null;
    const down = (event: PointerEvent) => {
      const element = dialog();
      if (element && !onControl(event)) {
        this.start(event, element);
      }
    };
    const move = (event: PointerEvent) => this.move(event);
    const up = () => this.end();
    const twice = (event: MouseEvent) => {
      if (!onControl(event)) {
        this.center();
      }
    };
    area.addEventListener("pointerdown", down);
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerup", up);
    area.addEventListener("pointercancel", up);
    area.addEventListener("dblclick", twice);
    return {
      destroy: () => {
        area.removeEventListener("pointerdown", down);
        area.removeEventListener("pointermove", move);
        area.removeEventListener("pointerup", up);
        area.removeEventListener("pointercancel", up);
        area.removeEventListener("dblclick", twice);
      },
    };
  };
}
