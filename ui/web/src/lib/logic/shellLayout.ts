// Panel sizes in the app shell: a side panel may grow until the editor area would get narrower than its minimum,
// and the bottom panel until the editors would get shorter than theirs. A panel never shrinks below its own minimum.

/** The largest width a side panel may take next to the other side panel. */
export function sidePanelMax(
  bodyWidth: number,
  barsWidth: number,
  otherPanelWidth: number,
  minMain: number,
  minPanel: number,
): number {
  return Math.max(minPanel, Math.round(bodyWidth - barsWidth - minMain - otherPanelWidth));
}

/** The largest height the bottom panel may take. */
export function bottomPanelMax(mainHeight: number, minEditorHeight: number, minPanel: number): number {
  return Math.max(minPanel, Math.round(mainHeight - minEditorHeight));
}

/** A stored size kept within the current limits; an unmeasured shell (max 0) keeps the stored size. */
export function clampPanel(size: number, minPanel: number, maxPanel: number): number {
  if (maxPanel <= 0) {
    return Math.max(minPanel, size);
  }
  return Math.min(Math.max(size, minPanel), Math.max(minPanel, maxPanel));
}
