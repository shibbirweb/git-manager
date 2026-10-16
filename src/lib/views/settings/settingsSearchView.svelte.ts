// The Settings search as the rows see it: the dialog sets the words and the open section, and every
// SettingsRow and SettingsGroup asks whether it shows and what to mark (settingsVisibility.ts decides).

import { getContext, setContext } from "svelte";
import type { SettingsSection } from "$lib/stores/settingsData";
import { matchingEntries, SETTINGS_SEARCH_INDEX } from "./settingsSearch";
import { sectionVisibility } from "./settingsVisibility";

const VIEW_KEY = Symbol("settings-search-view");
const GROUP_KEY = Symbol("settings-search-group");

export class SettingsSearchView {
  words = $state.raw<string[]>([]);
  section = $state<SettingsSection>("appearance");
  sectionLabels = $state.raw<Readonly<Record<SettingsSection, string>>>({} as Record<SettingsSection, string>);

  readonly searching = $derived(this.words.length > 0);
  readonly found = $derived(matchingEntries(this.words, this.sectionLabels));
  readonly visibility = $derived(sectionVisibility(this.section, SETTINGS_SEARCH_INDEX, this.found, this.words));
  readonly #indexed = $derived(
    new Set(SETTINGS_SEARCH_INDEX.filter((entry) => entry.section === this.section).map((entry) => entry.label)),
  );

  /** Whether a row or group title shows; a row the index does not list follows its group's own match. */
  shows(title: string, group: string | null): boolean {
    if (!this.searching) {
      return true;
    }
    if (this.#indexed.has(title)) {
      return this.visibility.shown.has(title);
    }
    return group !== null && this.visibility.matchedGroups.has(group);
  }

  /** The [start, end) ranges of the title to mark while searching. */
  marks(title: string): [number, number][] {
    return this.searching ? (this.visibility.marks.get(title) ?? []) : [];
  }
}

export function provideSettingsSearch(view: SettingsSearchView): void {
  setContext(VIEW_KEY, view);
}

/** The dialog's search, or null outside the dialog (a row then always shows). */
export function useSettingsSearch(): SettingsSearchView | null {
  return getContext<SettingsSearchView | undefined>(VIEW_KEY) ?? null;
}

/** The group a row sits in, for rows the index does not list. */
export function provideSettingsGroup(title: () => string): void {
  setContext(GROUP_KEY, title);
}

export function useSettingsGroup(): () => string | null {
  return getContext<(() => string) | undefined>(GROUP_KEY) ?? (() => null);
}
