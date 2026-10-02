// Split terminals, like VS Code: the panel's terminals form groups, a group's
// terminals sit side by side, and the list shows each group's members together.
// A group's pane sizes are fractions of the panel width that add up to 1.
// Kept free of Svelte so it can be tested directly.

/** The parts of a terminal entry the group rules need. */
export interface GroupedTerminal {
  key: number;
  group: number;
}

export interface TerminalGroup {
  group: number;
  /** Member keys in pane order, left to right. */
  terminalKeys: number[];
}

/** A pane is never dragged narrower than this. */
export const MIN_PANE_WIDTH = 120;

/** The groups of the panel's terminals, in list order; members keep their list order. */
export function terminalGroups(terminals: GroupedTerminal[]): TerminalGroup[] {
  const groups: TerminalGroup[] = [];
  const byGroup = new Map<number, TerminalGroup>();
  for (const terminal of terminals) {
    let entry = byGroup.get(terminal.group);
    if (!entry) {
      entry = { group: terminal.group, terminalKeys: [] };
      byGroup.set(terminal.group, entry);
      groups.push(entry);
    }
    entry.terminalKeys.push(terminal.key);
  }
  return groups;
}

/** Keys of the terminals sharing a group with `terminalKey` (itself included), in pane order. */
export function groupMembers(terminals: GroupedTerminal[], terminalKey: number): number[] {
  const group = terminals.find((terminal) => terminal.key === terminalKey)?.group;
  if (group === undefined) {
    return [];
  }
  return terminals.filter((terminal) => terminal.group === group).map((terminal) => terminal.key);
}

/** Sizes for `count` panes: the saved ones when they fit, else equal shares. */
export function normalizeSizes(sizes: number[] | undefined, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const valid =
    sizes !== undefined &&
    sizes.length === count &&
    sizes.every((size) => Number.isFinite(size) && size > 0) &&
    Math.abs(sizes.reduce((sum, size) => sum + size, 0) - 1) < 0.001;
  if (valid) {
    return sizes;
  }
  return Array.from({ length: count }, () => 1 / count);
}

/** Splitting pane `index` halves it; the new pane sits right of it. */
export function sizesAfterSplit(sizes: number[], index: number): number[] {
  if (sizes.length === 0) {
    return [0.5, 0.5];
  }
  const at = Math.min(Math.max(index, 0), sizes.length - 1);
  const half = sizes[at] / 2;
  return [...sizes.slice(0, at), half, half, ...sizes.slice(at + 1)];
}

/** Closing pane `index` gives its width to its left neighbor (the right one for the first pane). */
export function sizesAfterClose(sizes: number[], index: number): number[] {
  if (index < 0 || index >= sizes.length) {
    return sizes;
  }
  if (sizes.length <= 1) {
    return [];
  }
  const freed = sizes[index];
  const rest = [...sizes.slice(0, index), ...sizes.slice(index + 1)];
  const neighbor = index > 0 ? index - 1 : 0;
  rest[neighbor] += freed;
  return rest;
}

/**
 * Dragging the divider right of pane `index` by `deltaFraction` of the panel
 * width moves width between that pane and the next; neither gets narrower
 * than `minFraction`.
 */
export function resizePanes(sizes: number[], index: number, deltaFraction: number, minFraction: number): number[] {
  if (index < 0 || index >= sizes.length - 1 || !Number.isFinite(deltaFraction)) {
    return sizes;
  }
  const left = sizes[index];
  const right = sizes[index + 1];
  const pair = left + right;
  const floor = Math.min(minFraction, pair / 2);
  const nextLeft = Math.min(pair - floor, Math.max(floor, left + deltaFraction));
  const next = [...sizes];
  next[index] = nextLeft;
  next[index + 1] = pair - nextLeft;
  return next;
}

/** Where a row of the terminal list sits in its group, for the tree lines drawn beside split terminals. */
export type GroupRowPosition = "single" | "first" | "middle" | "last";

export function groupRowPosition(group: TerminalGroup, terminalKey: number): GroupRowPosition {
  const count = group.terminalKeys.length;
  if (count <= 1) {
    return "single";
  }
  const index = group.terminalKeys.indexOf(terminalKey);
  if (index <= 0) {
    return "first";
  }
  return index === count - 1 ? "last" : "middle";
}
