// Clear Cache: saves the window's state, then asks the backend to restart the page in a new
// WebKit web content process (memory.rs). A reload in the same process keeps what the old page
// held; a new process starts like the app did, and the folder and tabs are restored.

import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { clearCachePlan } from "./clearCachePlan";

let running = false;

export async function clearCache(): Promise<void> {
  if (running) {
    return;
  }
  const plan = clearCachePlan({
    dirtyFiles: repoStore.tabs.filter((tab) => tab.dirty).length,
    terminals: terminalStore.terminals.length,
    busy: repoStore.busy,
    mergeOpen: repoStore.mergeTarget !== null,
  });
  if (plan.kind === "blocked") {
    toast.warning("Cannot clear the cache now", plan.message);
    return;
  }
  if (plan.kind === "confirm") {
    const confirmed = await dialogs.confirm({ title: "Clear Cache", message: plan.message, confirmLabel: "Clear Cache", danger: true });
    if (!confirmed) {
      return;
    }
  }
  running = true;
  try {
    repoStore.saveTabsNow();
    await settings.flushNow();
    if (terminalStore.terminals.length > 0) {
      await api.terminalCloseAll();
    }
    // The page goes away a moment after this answers.
    await api.clearCache();
  } catch (error) {
    running = false;
    toast.error("Could not clear the cache", errorMessage(error));
  }
}
