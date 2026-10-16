// A Toolbar or Stack with `responsive` measures its own width and tells what is inside how narrow it is, so a Text,
// Badge, Divider or Stack can step aside at the same widths on every platform (the panel breakpoints in the design
// tokens), like the app's file toolbar, which drops its counter, then shows badges as dots, then drops its dividers,
// and the Changes panel's repository rows, which drop the branch name, then the sync counts, then the change count.
import { getContext, setContext } from "svelte";
import { isAtOrBelow, panelSize, type NarrowStep, type PanelSize } from "./breakpoints";

const BAR_KEY = Symbol("gm-bar-size");

export class BarSize {
  size = $state<PanelSize | null>(null);

  /** A Svelte action: `use:bar.observe={responsive}` measures the node only while `responsive` is on. */
  observe = (node: HTMLElement, enabled: boolean) => {
    let observer: ResizeObserver | null = null;
    let frame = 0;
    const stop = () => {
      observer?.disconnect();
      observer = null;
      cancelAnimationFrame(frame);
    };
    const watch = (on: boolean) => {
      stop();
      this.size = null;
      if (on) {
        // Applied on the next frame: hiding a part can change the bar's height, and a change while the browser
        // is still delivering this resize ends in a "ResizeObserver loop" error.
        observer = new ResizeObserver(([entry]) => {
          const width = entry?.contentRect.width ?? 0;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            this.size = panelSize(width);
          });
        });
        observer.observe(node);
      }
    };
    watch(enabled);
    return { update: watch, destroy: stop };
  };
}

export function provideBarSize(bar: BarSize): void {
  setContext(BAR_KEY, bar);
}

/** Whether the nearest responsive bar is at `step` or narrower; outside one, never. */
export function useNarrow(step: () => NarrowStep | null): () => boolean {
  const bar = getContext<BarSize | undefined>(BAR_KEY);
  return () => isAtOrBelow(bar?.size ?? null, step());
}
