// The rows of the Search Everywhere popup (FileSearch.svelte) for each tab, keyboard
// selection over the selectable ones, and the window of rows the virtual list renders.

import { countLabel, type CountWord } from "./countLabel";
import { moveSelection, type SearchRow } from "./fileSearchModel";
import type { SearchTab } from "./searchTabs";
import type { SymbolRow } from "./symbolSearchModel";
import type { TextResults, TextRow } from "./textSearchModel";

/** Results of the All tab per section. */
export const SECTION_LIMIT = 6;

export type PopupRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "file"; key: string; file: SearchRow }
  | { kind: "symbol"; key: string; symbol: SymbolRow }
  | { kind: "more"; key: string; tab: SearchTab; label: string }
  | TextRow;

/** Results of one query; `rows` holds the best `matched`. */
export interface SourceResults<T> {
  rows: T[];
  matched: number;
}

export function emptySource<T>(): SourceResults<T> {
  return { rows: [], matched: 0 };
}

/** The status line of the Files, Classes and Symbols tabs: "2 classes", or how many of them are shown. */
export function shownLabel(source: SourceResults<unknown>, word: CountWord): string {
  if (source.matched > source.rows.length) {
    return `Showing the first ${source.rows.length} of ${source.matched.toLocaleString()}`;
  }
  return countLabel(source.matched, word);
}

export interface PopupResults {
  /** The query has text to match (files: without its ":LINE" part). */
  hasQuery: boolean;
  recent: SearchRow[];
  files: SourceResults<SearchRow>;
  classes: SourceResults<SymbolRow>;
  /** Everything but classes, for the All tab. */
  members: SourceResults<SymbolRow>;
  symbols: SourceResults<SymbolRow>;
  text: TextResults;
}

function fileRows(rows: SearchRow[], prefix = "f"): PopupRow[] {
  return rows.map((file) => ({ kind: "file", key: `${prefix}:${file.path}`, file }));
}

function symbolRowsOf(rows: SymbolRow[], prefix: string): PopupRow[] {
  return rows.map((symbol) => ({ kind: "symbol", key: `${prefix}:${symbol.key}`, symbol }));
}

function recentRows(recent: SearchRow[]): PopupRow[] {
  if (recent.length === 0) {
    return [];
  }
  return [{ kind: "header", key: "h:recent", label: "Recent Files" }, ...fileRows(recent, "r")];
}

/** One All-tab section: a heading, the best few rows and a "more" row leading to its tab. */
function section(label: string, tab: SearchTab, rows: PopupRow[], matched: number): PopupRow[] {
  if (rows.length === 0) {
    return [];
  }
  const shown = rows.slice(0, SECTION_LIMIT);
  const out: PopupRow[] = [{ kind: "header", key: `h:${tab}`, label }, ...shown];
  const rest = Math.max(matched, rows.length) - shown.length;
  if (rest > 0) {
    out.push({ kind: "more", key: `m:${tab}`, tab, label: `${rest.toLocaleString()} more` });
  }
  return out;
}

/** What `tab` lists for the current results. */
export function tabRows(tab: SearchTab, results: PopupResults): PopupRow[] {
  switch (tab) {
    case "all":
      if (!results.hasQuery) {
        return recentRows(results.recent);
      }
      return [
        ...section("Classes", "classes", symbolRowsOf(results.classes.rows, "c"), results.classes.matched),
        ...section("Files", "files", fileRows(results.files.rows), results.files.matched),
        ...section("Symbols", "symbols", symbolRowsOf(results.members.rows, "s"), results.members.matched),
      ];
    case "files":
      return results.hasQuery ? fileRows(results.files.rows) : recentRows(results.recent);
    case "classes":
      return results.hasQuery ? symbolRowsOf(results.classes.rows, "c") : [];
    case "symbols":
      return results.hasQuery ? symbolRowsOf(results.symbols.rows, "s") : [];
    case "text":
      return results.text.rows;
  }
}

export function isSelectable(row: PopupRow): boolean {
  return row.kind !== "header" && row.kind !== "textFile";
}

export function firstSelectable(rows: PopupRow[]): number {
  return Math.max(0, rows.findIndex(isSelectable));
}

/**
 * The row to select after a key, skipping headings: single steps wrap around
 * (as in JetBrains), page steps stop at the ends.
 */
export function moveSelectable(rows: PopupRow[], selected: number, step: number): number {
  const selectable: number[] = [];
  rows.forEach((row, index) => {
    if (isSelectable(row)) {
      selectable.push(index);
    }
  });
  if (selectable.length === 0) {
    return 0;
  }
  let position = selectable.findIndex((index) => index >= selected);
  if (position < 0) {
    position = selectable.length - 1;
  }
  return selectable[moveSelection(position, selectable.length, step)];
}

/** Keeps the same row selected when rows refresh (e.g. while indexing or streaming), else the first. */
export function keepSelectedKey(previous: PopupRow[], selected: number, next: PopupRow[]): number {
  const key = previous[selected]?.key;
  const index = key ? next.findIndex((row) => row.key === key) : -1;
  return index >= 0 && isSelectable(next[index]) ? index : firstSelectable(next);
}

/** Rows a virtual list renders: what fits in the viewport plus `overscan` on each side. */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan = 6,
): { start: number; end: number } {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  // Before the first layout the viewport is unknown: render one screenful.
  const visible = Math.ceil((viewportHeight > 0 ? viewportHeight : rowHeight * 16) / rowHeight) + 1;
  // A list that shrank under an old scroll position renders from its end.
  const start = Math.min(count, Math.max(0, first - overscan));
  const end = Math.min(count, first + visible + overscan);
  return { start, end: Math.max(start, end) };
}

/**
 * The scroll position that shows row `index`, or `scrollTop` when it already shows.
 * Selecting the first selectable row scrolls to the top so its heading shows too.
 */
export function scrollToShow(index: number, scrollTop: number, viewportHeight: number, rowHeight: number, firstIndex: number): number {
  if (index <= firstIndex) {
    return 0;
  }
  const top = index * rowHeight;
  if (top < scrollTop) {
    return top;
  }
  if (viewportHeight > 0 && top + rowHeight > scrollTop + viewportHeight) {
    return top + rowHeight - viewportHeight;
  }
  return scrollTop;
}
