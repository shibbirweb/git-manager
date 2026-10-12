// The split between two side-by-side views as a ratio of the width: from a pointer's position, or a key press,
// kept within limits so neither side disappears.

export const MIN_RATIO = 0.15;
export const MAX_RATIO = 0.85;
const KEY_STEP = 0.02;

export function clampRatio(ratio: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

/** The ratio where the pointer is, inside a box from `left` that is `width` wide. */
export function pointerRatio(clientX: number, left: number, width: number): number {
  return width > 0 ? clampRatio((clientX - left) / width) : 0.5;
}

/** The ratio after an arrow key (Shift moves five times as far); null for other keys. */
export function keyedRatio(ratio: number, key: string, shift: boolean): number | null {
  const step = KEY_STEP * (shift ? 5 : 1);
  if (key === "ArrowLeft") {
    return clampRatio(ratio - step);
  }
  if (key === "ArrowRight") {
    return clampRatio(ratio + step);
  }
  return null;
}
