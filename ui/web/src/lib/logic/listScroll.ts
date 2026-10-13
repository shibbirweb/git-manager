// Where a List's scroll stands: near the end (load the next page, like File History and the reflog) or at the
// bottom (keep following new entries, like the Git console, until the user scrolls up).

/** How close to the end, in pixels, the next page starts loading. */
export const NEAR_END_PX = 200;

/** Within this many pixels of the bottom still counts as at the bottom (fractional scroll positions). */
export const BOTTOM_SLACK_PX = 4;

export function isNearEnd(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  return scrollTop + clientHeight >= scrollHeight - NEAR_END_PX;
}

export function isAtBottom(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  return scrollTop + clientHeight >= scrollHeight - BOTTOM_SLACK_PX;
}
