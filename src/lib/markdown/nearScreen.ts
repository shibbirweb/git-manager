// Tells diagrams and images when they come near the visible part of their scroller, and when
// they go far from it, so a long document draws only what can be seen (and soon will be) and
// frees what is far away. Memory then follows the screen, not the length of the file.

interface Watched {
  show: () => void;
  hide: () => void;
}

/** How far outside the view an element still counts as near: one screen above and below. */
const NEAR_MARGIN = "100% 0px 100% 0px";

export class NearScreen {
  private readonly observer: IntersectionObserver;
  private readonly watched = new Map<Element, Watched>();

  constructor(root: Element | null) {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const handlers = this.watched.get(entry.target);
          if (!handlers) {
            continue;
          }
          if (entry.isIntersecting) {
            handlers.show();
          } else {
            handlers.hide();
          }
        }
      },
      { root, rootMargin: NEAR_MARGIN },
    );
  }

  /** `show` runs once it is near (right away if it already is), `hide` once it is far again. */
  watch(element: Element, show: () => void, hide: () => void = () => undefined): void {
    this.watched.set(element, { show, hide });
    this.observer.observe(element);
  }

  unwatch(element: Element): void {
    if (this.watched.delete(element)) {
      this.observer.unobserve(element);
    }
  }

  /** Stops watching everything inside `root` (a block that was removed). */
  unwatchWithin(root: Element): void {
    for (const element of [...this.watched.keys()]) {
      if (root === element || root.contains(element)) {
        this.unwatch(element);
      }
    }
  }

  disconnect(): void {
    this.observer.disconnect();
    this.watched.clear();
  }
}

/** Frees a drawn diagram far from view, keeping its height so nothing below it moves. */
export function releaseDiagram(diagram: HTMLElement): void {
  if (diagram.dataset.released === "true" || diagram.childElementCount === 0) {
    return;
  }
  diagram.style.height = `${diagram.offsetHeight}px`;
  diagram.replaceChildren();
  diagram.dataset.released = "true";
}

/** A released diagram is about to be drawn again: it may take its own height once drawn. */
export function restoreDiagramHeight(diagram: HTMLElement): void {
  delete diagram.dataset.released;
  diagram.style.height = "";
}
