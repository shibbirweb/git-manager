// Unload hidden tabs: a file tab out of sight for a while, without unsaved edits, gives its
// editor back and sleeps like a tab restored at start. Showing it builds the editor again at
// its caret and scroll position. Only the decision lives here; repo.svelte.ts applies it.

/** Minutes a tab may stay hidden before it sleeps. */
export const UNLOAD_TAB_MINUTES = [5, 15, 30, 60] as const;

/** How often the open tabs are checked. */
export const TAB_SLEEP_CHECK_MS = 30_000;

export interface TabSleepEntry {
  /** The tab's key: the same file can be open in each editor group. */
  key: string;
  /** The tab its group shows. */
  shown: boolean;
  /** A file tab without unsaved edits whose editor is still there. */
  eligible: boolean;
}

/**
 * Notes when each tab was last on screen in `lastShown` (a tab seen hidden for the first time
 * starts counting now) and returns the keys of the tabs hidden for at least `delayMs`.
 * Tabs that were closed are forgotten.
 */
export function tabsToSleep(entries: readonly TabSleepEntry[], lastShown: Map<string, number>, now: number, delayMs: number): string[] {
  const open = new Set(entries.map((entry) => entry.key));
  for (const key of [...lastShown.keys()]) {
    if (!open.has(key)) {
      lastShown.delete(key);
    }
  }
  const sleeping: string[] = [];
  for (const entry of entries) {
    const since = lastShown.get(entry.key);
    if (entry.shown || since === undefined) {
      lastShown.set(entry.key, now);
      continue;
    }
    if (entry.eligible && now - since >= delayMs) {
      sleeping.push(entry.key);
    }
  }
  return sleeping;
}

export function pickUnloadTabMinutes(value: unknown, fallback: number): number {
  return (UNLOAD_TAB_MINUTES as readonly unknown[]).includes(value) ? (value as number) : fallback;
}
