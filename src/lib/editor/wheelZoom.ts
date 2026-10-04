// Ctrl/Cmd + mouse wheel over an editor changes the editor font size. Trackpad pinches arrive as ctrl+wheel too.

import { FONT_SIZE_RANGE } from "$lib/stores/settings.svelte";

/** Wheel distance (pixels) per size step; one mouse notch is about 100. */
const DELTA_PER_STEP = 50;
export const ZOOM_STEP = 0.5;

/**
 * Turns wheel deltas into font size steps, accumulating small trackpad
 * deltas so a gentle pinch still changes the size. Returns the new size.
 */
export class WheelZoom {
  private pending = 0;

  apply(currentSize: number, deltaY: number, deltaMode = 0): number {
    // Line-based deltas (some mice) count as roughly 40 pixels per line.
    this.pending += deltaMode === 1 ? deltaY * 40 : deltaY;
    let size = currentSize;
    while (Math.abs(this.pending) >= DELTA_PER_STEP) {
      // Scrolling up (negative delta) makes the text bigger.
      size += this.pending < 0 ? ZOOM_STEP : -ZOOM_STEP;
      this.pending += this.pending < 0 ? DELTA_PER_STEP : -DELTA_PER_STEP;
    }
    const [min, max] = FONT_SIZE_RANGE.editor;
    const clamped = Math.min(max, Math.max(min, size));
    if (clamped !== size) {
      // Do not keep winding up past the limit.
      this.pending = 0;
    }
    return clamped;
  }

  reset(): void {
    this.pending = 0;
  }
}

/** View > Zoom In / Zoom Out: one pixel per step, on the half-pixel grid the wheel uses, within the allowed sizes. */
export function steppedFontSize(currentSize: number, step: 1 | -1): number {
  const [min, max] = FONT_SIZE_RANGE.editor;
  const next = Math.round((currentSize + step) / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(max, Math.max(min, next));
}
