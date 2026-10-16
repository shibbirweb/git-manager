// The editor find bar's props, counter and its own keys, for callers that leave them to the bar.
import type { SearchOptions } from "../components/SearchToggles.svelte";

export type FindField = "find" | "replace";

export type FindBarTitles = Partial<
  Record<"previous" | "next" | "selectAll" | "replace" | "replaceAll" | "exclude" | "close" | "showReplace", string>
>;

export interface FindBarProps {
  query?: string;
  replacement?: string;
  options?: SearchOptions;
  showReplace?: boolean;
  editable?: boolean;
  current?: number;
  total?: number;
  counter?: string | null;
  active?: boolean | null;
  problem?: string | null;
  label?: string;
  titles?: FindBarTitles;
  toggleTitles?: Partial<Record<keyof SearchOptions, string>>;
  onsearch?: (query: string, options: SearchOptions) => void;
  onreplaceinput?: (replacement: string) => void;
  ontogglereplace?: (open: boolean) => void;
  onkeydown?: (event: KeyboardEvent, field: FindField) => void;
  onnext?: () => void;
  onprevious?: () => void;
  onreplace?: () => void;
  onreplaceall?: () => void;
  onselectall?: () => void;
  onexclude?: () => void;
  onclose?: () => void;
}

export const FIND_BAR_TITLES: Required<FindBarTitles> = {
  previous: "Previous Occurrence",
  next: "Next Occurrence",
  selectAll: "Select All Occurrences",
  replace: "Replace",
  replaceAll: "Replace All",
  exclude: "Exclude: skip this match and go to the next",
  close: "Close",
  showReplace: "Show Replace Field",
};

export type FindKey = Pick<KeyboardEvent, "key" | "shiftKey" | "isComposing">;

/** "2 of 5", "No results" with a query, nothing without one. */
export function findCounter(query: string, current: number, total: number): string {
  if (!query) {
    return "";
  }
  return total ? `${current} of ${total}` : "No results";
}

/** Enter goes to the next match, Shift+Enter the previous, Esc closes; anything else is not the bar's. */
export function findKey(event: FindKey): "next" | "previous" | "close" | null {
  if (event.isComposing) {
    return null;
  }
  if (event.key === "Enter") {
    return event.shiftKey ? "previous" : "next";
  }
  return event.key === "Escape" ? "close" : null;
}
