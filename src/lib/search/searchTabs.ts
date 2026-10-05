// The tabs of the Search Everywhere popup (FileSearch.svelte): which tab
// each shortcut opens, Tab / Shift+Tab cycling and the keys that switch tabs while open.

import type { CommandId } from "$lib/commands/registry";
import { type ShortcutKey, type ShortcutKeys, type WorkspaceShortcut, workspaceShortcut } from "$lib/views/workspaceShortcuts";

export type SearchTab = "all" | "classes" | "files" | "symbols" | "text";

/** What opened the popup: double Shift, or a shortcut for one tab. */
export type SearchOpener = "everywhere" | "files" | "classes" | "symbols" | "text";

export interface SearchTabInfo {
  id: SearchTab;
  label: string;
  /** The command whose keys open this tab; null for All, which double Shift opens. */
  commandId: CommandId | null;
}

export const SEARCH_TABS: readonly SearchTabInfo[] = [
  { id: "all", label: "All", commandId: null },
  { id: "classes", label: "Classes", commandId: "edit.goToClass" },
  { id: "files", label: "Files", commandId: "search.files" },
  { id: "symbols", label: "Symbols", commandId: "edit.goToSymbol" },
  { id: "text", label: "Text", commandId: "edit.findInFiles" },
];

/** The next tab (step 1) or the previous one (step -1), wrapping around. */
export function stepTab(tab: SearchTab, step: 1 | -1): SearchTab {
  const index = SEARCH_TABS.findIndex((info) => info.id === tab);
  const count = SEARCH_TABS.length;
  return SEARCH_TABS[(Math.max(0, index) + step + count) % count].id;
}

/**
 * The tab a popup opens on. Each tab shortcut always opens its tab; double Shift opens
 * the tab it was last left on (All the first time).
 */
export function openingTab(opener: SearchOpener, lastEverywhereTab: SearchTab | null): SearchTab {
  if (opener === "everywhere") {
    return lastEverywhereTab ?? "all";
  }
  return opener;
}

const SHORTCUT_TABS: Partial<Record<WorkspaceShortcut, Exclude<SearchOpener, "everywhere">>> = {
  // Outside the popup Cmd+P opens Quick Open; inside it, it still picks the Files tab.
  quickOpen: "files",
  goToFile: "files",
  goToClass: "classes",
  goToSymbol: "symbols",
  findInFiles: "text",
  replaceInFiles: "text",
};

/** The opener for a workspace shortcut, or null when it is not a search key. */
export function openerForShortcut(shortcut: WorkspaceShortcut): SearchOpener | null {
  return SHORTCUT_TABS[shortcut] ?? null;
}

/** A tab shortcut pressed while the popup shows switches to that tab. */
export function tabForKey(event: ShortcutKey, keys: ShortcutKeys): SearchTab | null {
  const shortcut = workspaceShortcut(event, { dialogOpen: false, mergeOpen: false }, keys);
  return shortcut ? (SHORTCUT_TABS[shortcut] ?? null) : null;
}

/** Shift+Cmd+R: the Text tab with its Replace field. */
export function isReplaceKey(event: ShortcutKey, keys: ShortcutKeys): boolean {
  return workspaceShortcut(event, { dialogOpen: false, mergeOpen: false }, keys) === "replaceInFiles";
}

/** Tabs whose results come from the symbol index. */
export function usesSymbols(tab: SearchTab): boolean {
  return tab === "all" || tab === "classes" || tab === "symbols";
}

/** Longest editor selection that starts a search; longer text is rarely a query. */
export const MAX_SELECTION_QUERY = 200;

/** The query a popup starts with for the editor's selected text: empty for blank, multi-line or long selections. */
export function queryFromSelection(selected: string): string {
  if (selected.trim() === "" || selected.includes("\n") || selected.length > MAX_SELECTION_QUERY) {
    return "";
  }
  return selected;
}
