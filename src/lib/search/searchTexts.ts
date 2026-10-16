// Search Everywhere's words around the results: the status at the field's end, the note that an index was capped,
// what an empty list says, and the field's placeholder, for each tab.
import type { FileSearchProgress, SymbolSearchProgress } from "$lib/types";
import { countLabel } from "./countLabel";
import { shownLabel, type SourceResults } from "./popupRows";
import { type SearchTab, usesSymbols } from "./searchTabs";
import { searchable, type TextResults, textStatus } from "./textSearchModel";

export interface SearchState {
  tab: SearchTab;
  query: string;
  /** The shown file and symbol results answer a query with text (not only ":42"). */
  hasQuery: boolean;
  files: SourceResults<unknown>;
  classes: SourceResults<unknown>;
  symbols: SourceResults<unknown>;
  text: TextResults;
  textRunning: boolean;
  replacing: "counting" | "writing" | null;
  fileIndex: FileSearchProgress | null;
  symbolIndex: SymbolSearchProgress | null;
  error: string | null;
}

const fileIndexing = (state: SearchState) => state.fileIndex !== null && !state.fileIndex.done;
const symbolIndexing = (state: SearchState) => state.symbolIndex !== null && !state.symbolIndex.done;

export function searchStatus(state: SearchState): string {
  const { tab } = state;
  if (tab === "text") {
    if (state.replacing !== null) {
      return state.replacing === "counting" ? "Counting matches..." : "Replacing...";
    }
    return textStatus(state.text, state.textRunning);
  }
  if (state.error) {
    return state.error;
  }
  if ((tab === "files" || tab === "all") && fileIndexing(state)) {
    return `Indexing ${countLabel(state.fileIndex?.indexed ?? 0, "file")}...`;
  }
  if (usesSymbols(tab) && symbolIndexing(state)) {
    return `Indexing symbols in ${countLabel(state.symbolIndex?.files ?? 0, "file")}...`;
  }
  if (!state.hasQuery) {
    return "";
  }
  if (tab === "files") {
    return shownLabel(state.files, "file");
  }
  if (tab === "classes") {
    return shownLabel(state.classes, "class");
  }
  return tab === "symbols" ? shownLabel(state.symbols, "symbol") : "";
}

/** The status is an error, shown in the warning color. */
export function statusIsError(state: SearchState): boolean {
  return state.tab === "text" ? state.text.error !== null : state.error !== null;
}

/** A note when the index stopped growing at its cap, or null. */
export function searchCapped(state: SearchState): string | null {
  const { tab, fileIndex, symbolIndex } = state;
  if ((tab === "files" || tab === "all" || tab === "text") && fileIndex?.truncated) {
    return `Only the first ${fileIndex.indexed.toLocaleString()} files are searched`;
  }
  if (usesSymbols(tab) && symbolIndex?.truncated) {
    return `Only the first ${symbolIndex.symbols.toLocaleString()} symbols are kept`;
  }
  return null;
}

export function searchEmptyText(state: SearchState): string {
  const { tab } = state;
  if (tab === "text") {
    if (!searchable(state.query)) {
      return "Type at least 2 characters to search file contents";
    }
    return state.text.error ?? (state.textRunning ? "Searching..." : "No matches");
  }
  if (!state.hasQuery) {
    if (tab === "classes") {
      return "Type a class, interface or type name";
    }
    if (tab === "symbols") {
      return "Type a function, method or constant name (Cart.add works too)";
    }
    return "No recent files";
  }
  if ((usesSymbols(tab) && symbolIndexing(state)) || (tab !== "classes" && tab !== "symbols" && fileIndexing(state))) {
    return "Indexing...";
  }
  if (tab === "classes") {
    return "No classes match";
  }
  if (tab === "symbols") {
    return "No symbols match";
  }
  return tab === "files" ? "No files match" : "Nothing found";
}

const PLACEHOLDERS: Record<SearchTab, string> = {
  all: "Search files, classes and symbols",
  classes: "Search classes by name",
  files: "Search files by name (use : for a line)",
  symbols: "Search functions, methods and constants",
  text: "Search file contents",
};

export function searchPlaceholder(tab: SearchTab): string {
  return PLACEHOLDERS[tab];
}
