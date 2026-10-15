// The effects a List sets up besides drawing: the filter field that drives it, and its scroll (load the next page
// near the end, follow new entries at the bottom). Call them while the List starts, like any $effect.
import { tick, untrack } from "svelte";
import { isAtBottom, isNearEnd } from "./listScroll";
import { scrollToCenterBox, scrollToShowBox } from "./rowOffsets";

/** Listens to a field's keys; with `combobox`, the field also names the list and its highlighted row. */
export function wireField(
  field: () => HTMLInputElement | null,
  combobox: () => { listId: string; activeId: string | undefined } | null,
  onkey: (event: KeyboardEvent) => void,
): void {
  $effect(() => {
    const element = field();
    element?.addEventListener("keydown", onkey);
    return () => element?.removeEventListener("keydown", onkey);
  });
  $effect(() => {
    const element = field();
    const names = combobox();
    if (!element || !names) {
      return;
    }
    element.setAttribute("aria-controls", names.listId);
    element.setAttribute("aria-activedescendant", names.activeId ?? "");
    return () => {
      element.removeAttribute("aria-controls");
      element.removeAttribute("aria-activedescendant");
    };
  });
}

export type RevealPlace = "nearest" | "center";

/** A row's top and bottom inside a list that draws only the rows in view. */
export type RowBox = [number, number];

export class ListScroll {
  top = $state(0);
  #atBottom = true;
  #nearEndAt = -1;

  /** Records a scroll; calls `onnearend` once per row count when the end comes near. */
  update(viewport: HTMLElement, count: number, onnearend: (() => void) | undefined): void {
    const { scrollTop, clientHeight, scrollHeight } = viewport;
    this.top = scrollTop;
    this.#atBottom = isAtBottom(scrollTop, clientHeight, scrollHeight);
    if (onnearend && this.#nearEndAt !== count && isNearEnd(scrollTop, clientHeight, scrollHeight)) {
      this.#nearEndAt = count;
      onnearend();
    }
  }

  /** Scrolls the least needed to show the box from `top` to `bottom`, or puts it in the middle with `center`. */
  show(viewport: HTMLElement, top: number, bottom: number, place: RevealPlace = "nearest"): void {
    const target =
      place === "center"
        ? scrollToCenterBox(top, bottom, viewport.clientHeight)
        : scrollToShowBox(top, bottom, viewport.scrollTop, viewport.clientHeight);
    if (target !== null) {
      viewport.scrollTop = target;
    }
  }

  /** Brings a row into view: by its element `rowId` when every row is drawn (`box` null), else by its box. */
  async reveal(viewport: HTMLElement | null, rowId: string, box: RowBox | null, place: RevealPlace): Promise<void> {
    if (!viewport) {
      return;
    }
    if (box === null) {
      await tick();
      document.getElementById(rowId)?.scrollIntoView({ block: place });
      return;
    }
    this.show(viewport, box[0], box[1], place);
  }

  /** Calls `reveal` whenever `height` changes to a measured value (a current row that opens or closes). */
  keep(height: () => number, reveal: () => void): void {
    $effect(() => {
      if (height() > 0) {
        untrack(reveal);
      }
    });
  }

  /** While `enabled`, a change in `size` scrolls to the bottom, unless the user scrolled up. */
  follow(viewport: () => HTMLElement | null, enabled: () => boolean, size: () => unknown): void {
    $effect(() => {
      void size();
      if (enabled() && this.#atBottom) {
        void tick().then(() => viewport()?.scrollTo({ top: viewport()?.scrollHeight ?? 0 }));
      }
    });
  }
}
