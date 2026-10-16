// A filter field above a List. With `enter`, Down or Enter in the field moves the focus into the list (Sidebar,
// Scripts, the log's filter). With `drive`, the field keeps the focus while Up, Down and the Page keys move the
// list's highlight and Enter opens the highlighted row (Quick Open, Recent Files, the Branches popup).
import type { ListKey } from "./listNav";

export type FieldKeys = "enter" | "drive";

export type FieldAction = { kind: "enter" } | { kind: "move"; key: ListKey } | { kind: "activate" } | null;

const DRIVE_KEYS: string[] = ["ArrowUp", "ArrowDown", "PageUp", "PageDown"];

/** What a key in the field does to its List; null leaves the key to the field (with modifiers, it always does). */
export function fieldAction(key: string, mode: FieldKeys, modified: boolean): FieldAction {
  if (modified) {
    return null;
  }
  if (mode === "enter") {
    return key === "ArrowDown" || key === "Enter" ? { kind: "enter" } : null;
  }
  if (DRIVE_KEYS.includes(key)) {
    return { kind: "move", key: key as ListKey };
  }
  return key === "Enter" ? { kind: "activate" } : null;
}

/** The row a driven list highlights: the current one while it is still listed, else the first pickable row. */
export function drivenSelection(current: string | null, pickable: string[]): string | null {
  if (current !== null && pickable.includes(current)) {
    return current;
  }
  return pickable[0] ?? null;
}
