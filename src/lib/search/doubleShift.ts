// Detects a double Shift: two quick taps of Shift alone. Kept
// pure (fed plain key events with their time stamps) so it can be tested
// without a DOM.

/** The parts of a KeyboardEvent the detector needs. */
export interface ShiftTapKey {
  /** "keydown" or "keyup"; anything else is ignored. */
  type: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing?: boolean;
  /** Milliseconds, e.g. `event.timeStamp`. */
  timeStamp: number;
}

/** Longest gap between the two taps, and longest a tap may hold Shift down. */
export const DOUBLE_SHIFT_MS = 350;

export class DoubleShift {
  /** When the Shift being held went down, or null when it is not a clean tap. */
  private downAt: number | null = null;
  /** When the last clean tap ended, or null. */
  private lastTapAt: number | null = null;

  constructor(private readonly windowMs = DOUBLE_SHIFT_MS) {}

  /** Feeds one key event; returns true when it completes a double Shift. */
  handle(event: ShiftTapKey): boolean {
    if (event.type !== "keydown" && event.type !== "keyup") {
      return false;
    }
    const otherModifier = event.metaKey || event.ctrlKey || event.altKey;
    if (event.key !== "Shift" || event.isComposing) {
      // Any other key (Shift+A, typing) spoils the tap in progress and the one before it.
      if (event.type === "keydown") {
        this.reset();
      }
      return false;
    }
    if (event.type === "keydown") {
      if (event.repeat) {
        return false;
      }
      if (otherModifier) {
        this.reset();
        return false;
      }
      if (this.lastTapAt !== null && event.timeStamp - this.lastTapAt > this.windowMs) {
        this.lastTapAt = null;
      }
      this.downAt = event.timeStamp;
      return false;
    }
    const downAt = this.downAt;
    this.downAt = null;
    if (downAt === null || otherModifier || event.timeStamp - downAt > this.windowMs) {
      this.lastTapAt = null;
      return false;
    }
    if (this.lastTapAt !== null && downAt - this.lastTapAt <= this.windowMs) {
      this.lastTapAt = null;
      return true;
    }
    this.lastTapAt = event.timeStamp;
    return false;
  }

  /** Forget everything, e.g. when the window loses focus. */
  reset(): void {
    this.downAt = null;
    this.lastTapAt = null;
  }
}
