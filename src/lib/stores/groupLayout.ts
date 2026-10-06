// How the editor groups are arranged (Window > Split Right / Split Down), like JetBrains: a
// binary tree whose leaves are groups and whose splits divide their area side by side
// ("right") or stacked ("down"). The page draws every group in one flat list, placed by
// `groupRects`, so a group keeps its editors mounted however the tree changes. Pure.

export type SplitDirection = "right" | "down";

export type GroupLayout =
  | { kind: "group"; groupId: number }
  | { kind: "split"; direction: SplitDirection; ratio: number; first: GroupLayout; second: GroupLayout };

/** Groups open at once; past this the panes get too small for code. */
export const MAX_GROUPS = 8;
export const DEFAULT_SPLIT_RATIO = 0.5;
/** Each side of a split keeps at least this share of it. */
export const SPLIT_RATIO_RANGE = [0.1, 0.9] as const;
/** Deeper than MAX_GROUPS allows; it stops a hand-edited state.json from nesting forever. */
const MAX_DEPTH = 16;

/** A part of the editor area, as fractions of its width and height. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The bar between the two sides of a split. `path` names the split: "0"/"1" per step from the root. */
export interface Splitter {
  path: string;
  direction: SplitDirection;
  ratio: number;
  /** The whole split's area; the bar sits at `ratio` of it. */
  rect: Rect;
}

export type GroupDirection = "left" | "right" | "up" | "down";

export function leafLayout(groupId: number): GroupLayout {
  return { kind: "group", groupId };
}

export function clampSplitRatio(ratio: number): number {
  const [min, max] = SPLIT_RATIO_RANGE;
  return Number.isFinite(ratio) ? Math.min(max, Math.max(min, ratio)) : DEFAULT_SPLIT_RATIO;
}

/** The groups left to right and top to bottom: first side before second at every split. */
export function layoutGroupIds(layout: GroupLayout): number[] {
  return layout.kind === "group" ? [layout.groupId] : [...layoutGroupIds(layout.first), ...layoutGroupIds(layout.second)];
}

/** `groupId`'s area split in two: the group keeps the first side and `newGroupId` takes the second. */
export function splitLayout(layout: GroupLayout, groupId: number, newGroupId: number, direction: SplitDirection): GroupLayout {
  if (layout.kind === "group") {
    return layout.groupId === groupId
      ? { kind: "split", direction, ratio: DEFAULT_SPLIT_RATIO, first: layout, second: leafLayout(newGroupId) }
      : layout;
  }
  const first = splitLayout(layout.first, groupId, newGroupId, direction);
  const second = first === layout.first ? splitLayout(layout.second, groupId, newGroupId, direction) : layout.second;
  return first === layout.first && second === layout.second ? layout : { ...layout, first, second };
}

/** Only the groups in `groupIds` stay; a split that loses one side gives its area to the other. Null when none stays. */
export function keepInLayout(layout: GroupLayout, groupIds: ReadonlySet<number>): GroupLayout | null {
  if (layout.kind === "group") {
    return groupIds.has(layout.groupId) ? layout : null;
  }
  const first = keepInLayout(layout.first, groupIds);
  const second = keepInLayout(layout.second, groupIds);
  if (!first || !second) {
    return first ?? second;
  }
  return first === layout.first && second === layout.second ? layout : { ...layout, first, second };
}

/** The split at `path` set to `ratio` (kept in SPLIT_RATIO_RANGE). */
export function setSplitRatio(layout: GroupLayout, path: string, ratio: number): GroupLayout {
  if (layout.kind === "group") {
    return layout;
  }
  if (path === "") {
    const next = clampSplitRatio(ratio);
    return next === layout.ratio ? layout : { ...layout, ratio: next };
  }
  const rest = path.slice(1);
  if (path[0] === "0") {
    const first = setSplitRatio(layout.first, rest, ratio);
    return first === layout.first ? layout : { ...layout, first };
  }
  const second = setSplitRatio(layout.second, rest, ratio);
  return second === layout.second ? layout : { ...layout, second };
}

function sides(rect: Rect, direction: SplitDirection, ratio: number): [Rect, Rect] {
  if (direction === "right") {
    const width = rect.width * ratio;
    return [
      { ...rect, width },
      { ...rect, x: rect.x + width, width: rect.width - width },
    ];
  }
  const height = rect.height * ratio;
  return [
    { ...rect, height },
    { ...rect, y: rect.y + height, height: rect.height - height },
  ];
}

const WHOLE: Rect = { x: 0, y: 0, width: 1, height: 1 };

/** Where each group sits in the editor area. */
export function groupRects(layout: GroupLayout, rect: Rect = WHOLE): Map<number, Rect> {
  if (layout.kind === "group") {
    return new Map([[layout.groupId, rect]]);
  }
  const [first, second] = sides(rect, layout.direction, layout.ratio);
  return new Map([...groupRects(layout.first, first), ...groupRects(layout.second, second)]);
}

/** Every split's bar, outer splits first. */
export function layoutSplitters(layout: GroupLayout, rect: Rect = WHOLE, path = ""): Splitter[] {
  if (layout.kind === "group") {
    return [];
  }
  const [first, second] = sides(rect, layout.direction, layout.ratio);
  return [
    { path, direction: layout.direction, ratio: layout.ratio, rect },
    ...layoutSplitters(layout.first, first, `${path}0`),
    ...layoutSplitters(layout.second, second, `${path}1`),
  ];
}

/** Which way `toId` lies from `fromId`, judged by the centers of their areas; null when either is missing. */
export function groupDirection(layout: GroupLayout, fromId: number, toId: number): GroupDirection | null {
  const rects = groupRects(layout);
  const from = rects.get(fromId);
  const to = rects.get(toId);
  if (!from || !to || fromId === toId) {
    return null;
  }
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

/** Groups side by side, for a saved session without a usable layout. */
export function rowLayout(groupIds: readonly number[]): GroupLayout {
  const [first, ...rest] = groupIds;
  if (rest.length === 0) {
    return leafLayout(first ?? 0);
  }
  // Each split gives the first group its fair share, so all end up the same width.
  return { kind: "split", direction: "right", ratio: 1 / groupIds.length, first: leafLayout(first), second: rowLayout(rest) };
}

/**
 * A layout from state.json whose leaves must be exactly the groups 0 to `count - 1`, each
 * once; anything else (a hand edit, an older version) gives null.
 */
export function parseGroupLayout(value: unknown, count: number): GroupLayout | null {
  const seen = new Set<number>();
  const parse = (node: unknown, depth: number): GroupLayout | null => {
    if (!node || typeof node !== "object" || Array.isArray(node) || depth > MAX_DEPTH) {
      return null;
    }
    const data = node as Record<string, unknown>;
    if (data.kind === "group") {
      const groupId = data.groupId;
      if (typeof groupId !== "number" || !Number.isInteger(groupId) || groupId < 0 || groupId >= count || seen.has(groupId)) {
        return null;
      }
      seen.add(groupId);
      return leafLayout(groupId);
    }
    if (data.kind !== "split" || (data.direction !== "right" && data.direction !== "down")) {
      return null;
    }
    const first = parse(data.first, depth + 1);
    const second = first ? parse(data.second, depth + 1) : null;
    if (!first || !second) {
      return null;
    }
    const ratio = typeof data.ratio === "number" ? clampSplitRatio(data.ratio) : DEFAULT_SPLIT_RATIO;
    return { kind: "split", direction: data.direction, ratio, first, second };
  };
  const layout = parse(value, 0);
  return layout && seen.size === count ? layout : null;
}

/** The layout with each group id replaced by `rename(groupId)`. */
export function renameGroups(layout: GroupLayout, rename: (groupId: number) => number): GroupLayout {
  if (layout.kind === "group") {
    return leafLayout(rename(layout.groupId));
  }
  return { ...layout, first: renameGroups(layout.first, rename), second: renameGroups(layout.second, rename) };
}
