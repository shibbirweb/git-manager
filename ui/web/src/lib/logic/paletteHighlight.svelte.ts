// The highlighted row of a CommandPalette: the preferred (or first pickable) row after a new query, the same item
// while the items refresh for the same query (results streaming in), the same place when the highlighted item went
// (removed from the list), moved by keys, and kept in view in the list.
import { paletteMove, paletteStep, type PaletteItem } from "./palette";

export class PaletteHighlight {
  index = $state(0);
  list = $state<HTMLElement | null>(null);
  #lastQuery: string | null = null;
  #lastId: string | null = null;

  constructor(
    private readonly items: () => PaletteItem[],
    query: () => string,
    preferred: () => string | null,
  ) {
    $effect(() => {
      const list = this.items();
      const same = query() === this.#lastQuery;
      const keep = same && this.#lastId !== null ? list.findIndex((item) => item.id === this.#lastId) : -1;
      const wanted = same ? -1 : list.findIndex((item) => item.id === preferred() && !item.disabled);
      if (keep >= 0 && !list[keep].disabled) {
        this.index = keep;
      } else if (same && this.#lastId !== null && list.length > 0) {
        // The highlighted item went (removed): stay at the same place.
        this.index = Math.min(this.index, list.length - 1);
      } else {
        this.index = wanted >= 0 ? wanted : (this.#pickable()[0] ?? -1);
      }
      this.#lastQuery = query();
    });
    $effect(() => {
      this.#lastId = this.items()[this.index]?.id ?? null;
      // Only rows are options (not section titles), so the index is the item's.
      this.list?.querySelectorAll<HTMLElement>('[role="option"]')[this.index]?.scrollIntoView({ block: "nearest" });
    });
  }

  #pickable(): number[] {
    return this.items()
      .map((item, index) => (item.disabled ? -1 : index))
      .filter((index) => index >= 0);
  }

  /** What a key in the field does: move the highlight, pick, close, or nothing (`ownList`: the caller's list). */
  key(event: KeyboardEvent, ownList: boolean): "moved" | "pick" | "close" | null {
    const by = ownList ? 0 : paletteStep(event);
    if (by !== 0) {
      this.step(by);
      return "moved";
    }
    if (event.key === "Enter" && !ownList && this.index >= 0) {
      return "pick";
    }
    return event.key === "Escape" ? "close" : null;
  }

  /** Moves by `by` pickable rows: single steps wrap around, page steps stop at the ends. */
  step(by: number): void {
    const pickable = this.#pickable();
    this.index = pickable[paletteMove(pickable.indexOf(this.index), pickable.length, by)] ?? -1;
  }
}
