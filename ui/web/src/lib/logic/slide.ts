// Slides elements from where they were to where a re-render put them (the FLIP technique), for items drawn by
// components, where Svelte's animate:flip cannot go. Used by TabStrip while a tab is dragged.

/** How long a slide takes, in milliseconds; the app's tabs slide in 120 ms. */
export const SLIDE_MS = 120;

/** Each element's position by key, taken before a change. */
export function positions(elements: HTMLElement[], keyOf: (element: HTMLElement) => string): Map<string, DOMRect> {
  return new Map(elements.map((element) => [keyOf(element), element.getBoundingClientRect()]));
}

/** Moves each element back to its old position at once, then lets it glide to its new one. */
export function slideFrom(
  elements: HTMLElement[],
  keyOf: (element: HTMLElement) => string,
  before: Map<string, DOMRect>,
  skip: string | null,
): void {
  for (const element of elements) {
    const key = keyOf(element);
    const old = before.get(key);
    if (!old || key === skip) {
      continue;
    }
    const now = element.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (dx === 0 && dy === 0) {
      continue;
    }
    const frames = [{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }];
    element.animate(frames, { duration: SLIDE_MS, easing: "ease-out" });
  }
}
