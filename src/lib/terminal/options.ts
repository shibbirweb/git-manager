// Maps the terminal preferences to xterm options and applies only the ones
// that changed, so a settings change updates open terminals without a restart.
// Kept free of Svelte and xterm so it can be tested directly.

import type { Preferences } from "$lib/stores/settingsData";
import { buildTerminalFontFamily, type XtermFontWeight, xtermFontWeight } from "./fonts";

export type TerminalPreferences = Pick<
  Preferences,
  | "editorFontFamily"
  | "terminalFontFamily"
  | "terminalFontSize"
  | "terminalLineHeight"
  | "terminalLetterSpacing"
  | "terminalFontWeight"
  | "terminalFontWeightBold"
  | "terminalNerdFontIcons"
  | "terminalCursorStyle"
  | "terminalCursorBlink"
  | "terminalScrollback"
>;

/** The xterm options that come from settings; a subset of xterm's ITerminalOptions. */
export interface TerminalDisplayOptions {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: XtermFontWeight;
  fontWeightBold: XtermFontWeight;
  cursorStyle: Preferences["terminalCursorStyle"];
  cursorBlink: boolean;
  scrollback: number;
}

/** Options that change the cell size, so the grid must be fitted again. */
export const METRIC_OPTIONS: ReadonlySet<keyof TerminalDisplayOptions> = new Set([
  "fontFamily",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "fontWeight",
  "fontWeightBold",
]);

/** The xterm options for these preferences; a shell that has exited never blinks. */
export function terminalDisplayOptions(preferences: TerminalPreferences, exited = false): TerminalDisplayOptions {
  return {
    fontFamily: buildTerminalFontFamily({
      terminalFontFamily: preferences.terminalFontFamily,
      editorFontFamily: preferences.editorFontFamily,
      nerdFontIcons: preferences.terminalNerdFontIcons,
    }),
    fontSize: preferences.terminalFontSize,
    lineHeight: preferences.terminalLineHeight,
    letterSpacing: preferences.terminalLetterSpacing,
    fontWeight: xtermFontWeight(preferences.terminalFontWeight),
    fontWeightBold: xtermFontWeight(preferences.terminalFontWeightBold),
    cursorStyle: preferences.terminalCursorStyle,
    cursorBlink: preferences.terminalCursorBlink && !exited,
    scrollback: preferences.terminalScrollback,
  };
}

/**
 * Writes the options that differ into `target` (xterm's `terminal.options`)
 * and returns their keys. Every write makes xterm redraw, so equal values are
 * skipped.
 */
export function applyChangedOptions(
  target: Partial<Record<keyof TerminalDisplayOptions, unknown>>,
  next: TerminalDisplayOptions,
): (keyof TerminalDisplayOptions)[] {
  const changed: (keyof TerminalDisplayOptions)[] = [];
  for (const key of Object.keys(next) as (keyof TerminalDisplayOptions)[]) {
    if (target[key] !== next[key]) {
      target[key] = next[key];
      changed.push(key);
    }
  }
  return changed;
}

/** Whether any of the changed options affects the cell size. */
export function changesMetrics(changedKeys: (keyof TerminalDisplayOptions)[]): boolean {
  return changedKeys.some((key) => METRIC_OPTIONS.has(key));
}
