// Named widths from the design tokens: a window is compact, regular or wide, and a panel (a sidebar, a dialog) is
// tiny, narrow, compact, medium or wide, so layouts change at the same points on every platform.
import { breakpoints } from "../styles/tokens";

export type WindowSize = "compact" | "regular" | "wide";
export type PanelSize = "tiny" | "narrow" | "compact" | "medium" | "wide";

export function windowSize(width: number): WindowSize {
  if (width < breakpoints.windowCompact) {
    return "compact";
  }
  return width < breakpoints.windowWide ? "regular" : "wide";
}

export function panelSize(width: number): PanelSize {
  if (width < breakpoints.panelTiny) {
    return "tiny";
  }
  if (width < breakpoints.panelNarrow) {
    return "narrow";
  }
  if (width < breakpoints.panelCompact) {
    return "compact";
  }
  return width < breakpoints.panelMedium ? "medium" : "wide";
}

/** Grid columns that fit `width` when each needs at least `minColumn` px and they are `gap` apart. */
export function columnsFor(width: number, minColumn: number, gap: number, maxColumns = 12): number {
  if (width <= 0 || minColumn <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minColumn + gap))));
}
