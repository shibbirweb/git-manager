// The rows of the Search Everywhere popup (FileSearch.svelte) for each tab, keyboard
// selection over the selectable ones, and the window of rows the virtual list renders.

import { countLabel, type CountWord } from "./countLabel";
import type { SearchRow } from "./fileSearchModel";
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
        ...section("Files", "files", fileRows(results.files.rows), results.files.matched),
        ...section("Classes", "classes", symbolRowsOf(results.classes.rows, "c"), results.classes.matched),
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
