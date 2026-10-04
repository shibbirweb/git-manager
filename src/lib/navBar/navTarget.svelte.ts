// What the floating Navigation Bar (Cmd+Up with no placed bar to answer it) points at: the
// file on screen in the focused group, else the active repository.

import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { changesSelection } from "$lib/views/changes/selection.svelte";

export interface NavTarget {
  path: string | null;
  isDir: boolean;
}

export function navTarget(): NavTarget {
  const filePath = repoStore.openFilePath;
  if (changesSelection.shownView === "file" && filePath !== null && !isPseudoTab(filePath)) {
    return { path: filePath, isDir: false };
  }
  return { path: repoStore.repo?.root ?? null, isDir: true };
}
