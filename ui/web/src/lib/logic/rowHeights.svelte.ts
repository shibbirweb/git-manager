// The heights of a List's drawn rows, by item key, kept up to date by one ResizeObserver, so a row that grows (an
// entry opening) moves the rows below it. Rows never drawn have no height here; the List uses its estimate.
import { rowOffsets } from "./rowOffsets";

export class RowHeights {
  heights = $state<Record<string, number>>({});
  #observer: ResizeObserver | null = null;

  /** A Svelte action: `use:rows.observe={key}` on each drawn row. */
  observe = (node: HTMLElement, key: string) => {
    this.#observer ??= new ResizeObserver((entries) => this.#record(entries));
    node.dataset.key = key;
    this.#observer.observe(node);
    return {
      update: (nextKey: string) => {
        node.dataset.key = nextKey;
      },
      destroy: () => this.#observer?.unobserve(node),
    };
  };

  /** Each row's top for `keys` in order, plus the total height; rows never measured count as `estimate`. */
  offsets(keys: string[], estimate: number): number[] {
    return rowOffsets(keys.length, (index) => this.heights[keys[index]] ?? estimate);
  }

  dispose() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  #record(entries: ResizeObserverEntry[]) {
    const next = { ...this.heights };
    let changed = false;
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      const key = target.dataset.key;
      if (key !== undefined && next[key] !== target.offsetHeight) {
        next[key] = target.offsetHeight;
        changed = true;
      }
    }
    if (changed) {
      this.heights = next;
    }
  }
}
