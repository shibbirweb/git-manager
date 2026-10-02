// Whether the Search Everywhere popup (FileSearch.svelte) is showing and which tab it
// opens on. Workspace.svelte opens it on double Shift and the tab shortcuts.

import { openingTab, type SearchOpener, type SearchTab } from "./searchTabs";

class FileSearchStore {
  isOpen = $state(false);
  /** The tab the popup opens on; read once when it mounts. */
  initialTab = $state<SearchTab>("files");
  /** Text to search for right away: the editor selection, if any. */
  initialQuery = $state("");
  /** Show the Text tab's Replace field (Shift+Cmd+R). */
  initialReplace = $state(false);

  private opener: SearchOpener = "files";
  /** Where double Shift left the popup last time; kept until the app quits. */
  private lastEverywhereTab: SearchTab | null = null;

  open(opener: SearchOpener, initialQuery = "", replace = false): void {
    this.opener = opener;
    this.initialTab = openingTab(opener, this.lastEverywhereTab);
    this.initialQuery = initialQuery;
    this.initialReplace = replace && this.initialTab === "text";
    this.isOpen = true;
  }

  /** The popup closed on `tab`. */
  close(tab: SearchTab | null = null): void {
    if (tab !== null && this.opener === "everywhere") {
      this.lastEverywhereTab = tab;
    }
    this.isOpen = false;
  }
}

export const fileSearch = new FileSearchStore();
