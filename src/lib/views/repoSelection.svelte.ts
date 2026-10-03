// The status bar's repository picker and its Auto mode, like VS Code: with Auto
// the active repository follows the open tab, otherwise it stays where the user
// put it. The decisions themselves are in repoSelection.ts.

import { untrack } from "svelte";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";
import { changesSelection } from "./changes/selection.svelte";
import { AUTO_PICK, repoPickItems, type ScreenRepo, screenRepo } from "./repoSelection";

/** The repository tied to what is on screen; read it inside `$derived` or `$effect`. */
export function currentScreenRepo(): ScreenRepo {
  return screenRepo({
    shownView: changesSelection.shownView,
    openFilePath: repoStore.openFilePath,
    selectedRepoRoot: changesSelection.selected?.repoRoot ?? null,
    repos: repoStore.repos,
    terminalCwd: (terminalKey) => terminalStore.find(terminalKey)?.cwd ?? null,
  });
}

/** Call once from a component: while Auto is on, the active repository follows the open tab. */
export function followOpenTab(): void {
  $effect(() => {
    if (!settings.activeRepoAuto) {
      return;
    }
    const screen = currentScreenRepo();
    // Switching would close the merge tool or the Conflicts dialog of the active repository.
    if (screen.kind !== "repo" || repoStore.mergeTarget || repoStore.conflictsOpen) {
      return;
    }
    // Not tracking the active repository: picking one elsewhere holds until the tab changes.
    untrack(() => {
      if (screen.repoRoot !== repoStore.repo?.root) {
        void repoStore.setActiveRepo(screen.repoRoot);
      }
    });
  });
}

/** Select a Repository: Auto, or one repository that stays active whatever tab is open. */
export async function openRepoPicker(): Promise<void> {
  const picked = await dialogs.pick({
    title: "Select a Repository",
    placeholder: "Type to filter repositories",
    items: repoPickItems(repoStore.repos, repoStore.statuses, settings.activeRepoAuto, repoStore.repo?.root ?? null),
  });
  if (picked === null) {
    return;
  }
  if (picked === AUTO_PICK) {
    settings.setActiveRepoAuto(true);
    return;
  }
  settings.setActiveRepoAuto(false);
  await repoStore.setActiveRepo(picked);
}
