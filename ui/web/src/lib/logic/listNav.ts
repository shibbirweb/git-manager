// Moving through a List with the keyboard: Up and Down step over rows that cannot be picked (headings), Home and
// End jump, Page Up and Page Down move a page; in a tree, Left and Right fold a row or move to its parent or child.

export type ListKey = "ArrowUp" | "ArrowDown" | "Home" | "End" | "PageUp" | "PageDown";

/** Rows Page Up and Page Down move by. */
export const PAGE_ROWS = 10;

export function isListKey(key: string): key is ListKey {
  return ["ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(key);
}

/** The index a key moves to from `current` (-1 for none) among `count` rows; `skip(i)` rows are passed over. */
export function moveIndex(
  current: number,
  count: number,
  key: ListKey,
  skip: (index: number) => boolean = () => false,
): number {
  const pickable = [...Array(count).keys()].filter((index) => !skip(index));
  if (pickable.length === 0) {
    return -1;
  }
  if (key === "Home" || (current < 0 && key !== "End")) {
    return pickable[0];
  }
  if (key === "End") {
    return pickable[pickable.length - 1];
  }
  const step = key === "ArrowUp" || key === "PageUp" ? -1 : 1;
  const distance = key === "PageUp" || key === "PageDown" ? PAGE_ROWS : 1;
  const target = current + step * distance;
  if (step > 0) {
    return pickable.find((index) => index >= target) ?? pickable[pickable.length - 1];
  }
  return [...pickable].reverse().find((index) => index <= target) ?? pickable[0];
}

/** The nearest row above `index` with a smaller level: its parent in a tree, or -1. */
export function parentIndex(levels: number[], index: number): number {
  const level = levels[index] ?? 0;
  for (let other = index - 1; other >= 0; other--) {
    if ((levels[other] ?? 0) < level) {
      return other;
    }
  }
  return -1;
}

export type TreeMove = { kind: "toggle"; open: boolean } | { kind: "move"; index: number } | null;

/**
 * What Left or Right does on a tree row: fold or unfold it, or move to its parent (Left) or first child (Right).
 * `expanded` is null for a row that cannot fold.
 */
export function treeMove(
  key: "ArrowLeft" | "ArrowRight",
  index: number,
  expanded: boolean | null,
  levels: number[],
): TreeMove {
  if (key === "ArrowRight") {
    if (expanded === false) {
      return { kind: "toggle", open: true };
    }
    if (expanded === true && (levels[index + 1] ?? -1) > (levels[index] ?? 0)) {
      return { kind: "move", index: index + 1 };
    }
    return null;
  }
  if (expanded === true) {
    return { kind: "toggle", open: false };
  }
  const parent = parentIndex(levels, index);
  return parent >= 0 ? { kind: "move", index: parent } : null;
}
