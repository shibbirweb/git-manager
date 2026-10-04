// Closing a window: asks about unsaved edits first, then the backend closes it and frees what
// it owned (watchers, terminals, search indexes). The last window closing quits the app.

import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, errorMessage } from "$lib/api";
import { repoStore } from "$lib/stores/repo.svelte";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";

let closing = false;

/** Window > Close Window and the close button. */
export async function closeThisWindow(): Promise<void> {
  if (closing) {
    return;
  }
  closing = true;
  try {
    if (await repoStore.confirmCloseWindow()) {
      await api.windowClose();
    }
  } catch (error) {
    toast.error("Could not close the window", errorMessage(error));
  } finally {
    closing = false;
  }
}

/** The close button asks the page first; returns the function that stops listening. */
export async function guardWindowClose(): Promise<(() => void) | null> {
  try {
    return await getCurrentWindow().onCloseRequested((event) => {
      // Always handled here: the backend closes the window once nothing is left unsaved.
      event.preventDefault();
      if (dialogs.active === null) {
        void closeThisWindow();
      }
    });
  } catch {
    return null;
  }
}
