// What a Settings search keeps on screen, worked out from the search index alone (its entries are in page order):
// which row and group titles show, and which to mark. The rows read this through settingsSearchView, so the
// dialog's markup never has to be searched or changed by hand.

import type { SettingsSection } from "$lib/stores/settingsData";
import { highlightSpans, type SearchBlock, type SettingsSearchEntry, visibleBlocks } from "./settingsSearch";

/** The group titles of each section; every other entry is a row, or a sub-row when it names a parent. */
export const SETTINGS_GROUP_TITLES: Partial<Record<SettingsSection, readonly string[]>> = {
  editor: ["Editing features", "Tabs", "Saving", "Local History", "Preview and blame"],
  merge: ["Commit identity", "Commit messages"],
  terminal: ["Shell", "Font", "Cursor", "Behavior", "Rendering"],
  automation: ["MCP server", "Command line tool", "Memory log"],
};

export interface SettingsVisibility {
  /** Titles of the rows, sub-rows and groups that stay on screen. */
  shown: Set<string>;
  /** Group titles that matched themselves: rows the index does not list follow these. */
  matchedGroups: Set<string>;
  /** What to mark in each shown title: the matched word starts, or the whole title when the match is elsewhere. */
  marks: Map<string, [number, number][]>;
}

/**
 * The visibility of one section for the entries a search found (`matched`, from matchingEntries). A found sub-row
 * also shows and marks its parent row, since the sub-row is hidden while its parent's switch is off.
 */
export function sectionVisibility(
  section: SettingsSection,
  index: readonly SettingsSearchEntry[],
  matched: readonly SettingsSearchEntry[],
  words: readonly string[],
): SettingsVisibility {
  const groups = new Set(SETTINGS_GROUP_TITLES[section] ?? []);
  const entries = index.filter((entry) => entry.section === section);
  const found = new Set(matched.filter((entry) => entry.section === section).map((entry) => entry.label));
  const foundThroughChild = new Set(
    matched.filter((entry) => entry.section === section && entry.parent !== null).map((entry) => entry.parent ?? ""),
  );
  const blocks: SearchBlock[] = entries.map((entry) => ({
    kind: groups.has(entry.label) ? "group" : entry.parent !== null ? "subRow" : "row",
    matched: found.has(entry.label) || foundThroughChild.has(entry.label),
  }));
  const visible = visibleBlocks(blocks);
  const shown = new Set(entries.filter((_, position) => visible[position]).map((entry) => entry.label));
  const matchedGroups = new Set(
    entries.filter((entry) => groups.has(entry.label) && found.has(entry.label)).map((entry) => entry.label),
  );
  const marks = new Map<string, [number, number][]>();
  for (const label of new Set([...found, ...foundThroughChild])) {
    const spans = highlightSpans(label, words);
    marks.set(label, spans.length > 0 ? spans : [[0, label.length]]);
  }
  return { shown, matchedGroups, marks };
}
