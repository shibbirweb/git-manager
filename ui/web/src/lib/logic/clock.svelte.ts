// One clock for every Time on screen: it ticks only while at least one live Time is shown, so relative times stay
// current with one timer instead of one per row or panel.

/** How often relative times are refreshed; the finest unit they show is a minute. */
export const CLOCK_TICK_MS = 30_000;

let now = $state(Date.now());
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/** Call while a component starts; returns the current time, which updates while `enabled` and the caller lives. */
export function useClock(enabled: () => boolean): () => number {
  $effect(() => {
    if (!enabled()) {
      return;
    }
    users += 1;
    if (users === 1) {
      now = Date.now();
      timer = setInterval(() => (now = Date.now()), CLOCK_TICK_MS);
    }
    return () => {
      users -= 1;
      if (users === 0) {
        clearInterval(timer);
        timer = undefined;
      }
    };
  });
  return () => now;
}
