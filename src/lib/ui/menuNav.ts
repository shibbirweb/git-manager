// Keyboard navigation and placement for the context menu and its submenus.

import type { MenuItem } from "./menu.svelte";

export function isSelectable(item: MenuItem | undefined): boolean {
  return item !== undefined && !("separator" in item) && !item.disabled;
}

export function hasSubmenu(item: MenuItem | undefined): boolean {
  return item !== undefined && "submenu" in item;
}

/** The next selectable index after `from` in `direction`, wrapping around; -1 when there is none. */
export function stepIndex(items: MenuItem[], from: number, direction: 1 | -1): number {
  const count = items.length;
  if (count === 0) {
    return -1;
  }
  let index = from < 0 ? (direction === 1 ? -1 : count) : from;
  for (let step = 0; step < count; step++) {
    index = (index + direction + count) % count;
    if (isSelectable(items[index])) {
      return index;
    }
  }
  return -1;
}

export function firstIndex(items: MenuItem[]): number {
  return stepIndex(items, -1, 1);
}

export function lastIndex(items: MenuItem[]): number {
  return stepIndex(items, -1, -1);
}

/** Type-ahead: the next selectable item after `from` whose label starts with `key`. */
export function matchIndex(items: MenuItem[], from: number, key: string): number {
  const wanted = key.toLowerCase();
  const count = items.length;
  for (let step = 1; step <= count; step++) {
    const index = (Math.max(from, -1) + step) % count;
    const item = items[index];
    if (isSelectable(item) && !("separator" in item) && item.label.trimStart().toLowerCase().startsWith(wanted)) {
      return index;
    }
  }
  return -1;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

const MARGIN = 4;

/** Where a submenu goes: right of its row, else left of the parent menu, kept inside the window. */
export function submenuPosition(row: Rect, menu: Size, viewport: Size): { left: number; top: number } {
  let left = row.right - 2;
  if (left + menu.width > viewport.width - MARGIN) {
    left = Math.max(MARGIN, row.left - menu.width + 2);
  }
  // Line the first item up with the row (the menu has 4px padding).
  const top = Math.max(MARGIN, Math.min(row.top - 5, viewport.height - menu.height - MARGIN));
  return { left, top };
}

/** Where the root menu goes, kept inside the window; `alignEnd` puts its right edge at `x`. */
export function rootPosition(x: number, y: number, menu: Size, viewport: Size, alignEnd: boolean): { left: number; top: number } {
  const wantedLeft = alignEnd ? x - menu.width : x;
  const left = Math.max(MARGIN, Math.min(wantedLeft, viewport.width - menu.width - MARGIN));
  const top = Math.max(MARGIN, Math.min(y, viewport.height - menu.height - MARGIN));
  return { left, top };
}
