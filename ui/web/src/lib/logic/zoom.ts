// Image zoom for media previews: fixed steps for zoom in and out, the zoom that fits an image (or both images of a
// compare) in its box, and scroll positions kept in step between two compared images.

export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;

export interface NaturalSize {
  width: number;
  height: number;
}

export interface ScrollBox {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

/** The next zoom step above (1) or below (-1) the current zoom, which may sit between steps. */
export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  }
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? ZOOM_STEPS[0];
}

/** The zoom that fits the whole image in the box; small images keep their real size. */
export function fitZoom(natural: NaturalSize | null, boxWidth: number, boxHeight: number): number {
  if (!natural || natural.width <= 0 || natural.height <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return 1;
  }
  return Math.min(1, boxWidth / natural.width, boxHeight / natural.height);
}

/** One zoom for several images, so a compare shows them at the same scale: the smallest fit. */
export function sharedFit(naturals: (NaturalSize | null)[], boxWidth: number, boxHeight: number): number {
  const fits = naturals
    .filter((natural): natural is NaturalSize => natural !== null)
    .map((natural) => fitZoom(natural, boxWidth, boxHeight));
  return fits.length > 0 ? Math.min(...fits) : 1;
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

function ratio(position: number, size: number, client: number): number {
  const range = size - client;
  return range > 0 ? Math.min(1, Math.max(0, position / range)) : 0;
}

/** The scroll position of `to` at the same place as `from`, in proportion to each range. */
export function syncedScroll(from: ScrollBox, to: ScrollBox): { left: number; top: number } {
  const left = ratio(from.scrollLeft, from.scrollWidth, from.clientWidth);
  const top = ratio(from.scrollTop, from.scrollHeight, from.clientHeight);
  return {
    left: Math.round(left * Math.max(0, to.scrollWidth - to.clientWidth)),
    top: Math.round(top * Math.max(0, to.scrollHeight - to.clientHeight)),
  };
}

/** An image's head line: its dimensions once measured, then the caller's size and type. */
export function mediaInfo(natural: NaturalSize | null, info: string): string {
  const size = natural ? `${natural.width} x ${natural.height} px` : "";
  return [size, info].filter(Boolean).join(", ");
}
