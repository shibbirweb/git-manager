// Clear Cache: saves the window's state and hands its terminals to the backend, then asks it to
// restart the page in a new WebKit web content process (memory.rs). A reload in the same process
// keeps what the old page held; a new process starts like the app did, and the folder, tabs and
// terminals come back, the shells still running.

import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { clearCachePlan } from "./clearCachePlan";

let running = false;

export async function clearCache(): Promise<void> {
  if (running) {
    return;
  }
  const plan = clearCachePlan({
    dirtyFiles: repoStore.tabs.filter((tab) => tab.dirty).length,
    busy: repoStore.busy,
    mergeOpen: repoStore.mergeTarget !== null,
  });
  if (plan.kind === "blocked") {
    toast.warning("Cannot clear the cache now", plan.message);
    return;
  }
  running = true;
  try {
    repoStore.saveTabsNow();
    await settings.flushNow();
    const stash = terminalStore.terminals.length > 0 ? await terminalStore.stashForClearCache() : null;
    // The page goes away a moment after this answers; the terminals wait for the new one.
    await api.clearCache(stash);
  } catch (error) {
    running = false;
    toast.error("Could not clear the cache", errorMessage(error));
  }
}
