// Keep computer awake (keepAwakeModel.ts): follows the mode in Settings and this window's agents, and asks the
// backend (keep_awake.rs) to hold or release the computer only when that changes.

import { untrack } from "svelte";
import { api, errorMessage } from "$lib/api";
import { settings } from "$lib/stores/settings.svelte";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { wantsAwake } from "./keepAwakeModel";

class KeepAwakeStore {
  /** The computer is held awake now (by this window or another). */
  active = $state(false);
  /** Why it could not be held, for the tooltip. */
  error = $state<string | null>(null);
  /** What this window last asked for; null before the first ask or after a failure. */
  private asked: boolean | null = null;

  /** Follows the mode and the agents until the returned stop; the app window starts it once. */
  start(): () => void {
    const stop = $effect.root(() => {
      $effect(() => {
        const states = terminalStore.terminals
          .filter((terminal) => terminal.agent && !terminal.exited)
          .map((terminal) => terminal.agent!.state);
        const wanted = wantsAwake(settings.computerAwakeMode, states);
        untrack(() => this.ask(wanted));
      });
    });
    return () => {
      stop();
      this.ask(false);
    };
  }

  private ask(wanted: boolean): void {
    if (this.asked === wanted) {
      return;
    }
    this.asked = wanted;
    api
      .setKeepAwake(wanted)
      .then((active) => {
        this.active = active;
        this.error = null;
      })
      .catch((error) => {
        this.asked = null;
        this.active = false;
        this.error = errorMessage(error);
      });
  }
}

export const keepAwake = new KeepAwakeStore();
