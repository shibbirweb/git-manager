// Find in the terminal: the search options xterm's search addon takes, the
// match counter, the highlight colors and the keys of the find bar. Kept free
// of Svelte and xterm so it can be tested directly.

import { composite, mix, toHex, withAlpha } from "$lib/themes/color";

export interface TerminalFindOptions {
  matchCase: boolean;
  wholeWords: boolean;
  regex: boolean;
}

export const DEFAULT_FIND_OPTIONS: TerminalFindOptions = { matchCase: false, wholeWords: false, regex: false };

/** Matches highlighted at most; xterm's addon stops counting there too. */
export const FIND_HIGHLIGHT_LIMIT = 1000;

/** The colors of the search addon's decorations; it only accepts #rrggbb. */
export interface FindDecorations {
  matchBackground: string;
  matchBorder: string;
  matchOverviewRuler: string;
  activeMatchBackground: string;
  activeMatchBorder: string;
  activeMatchColorOverviewRuler: string;
}

/** The xterm ISearchOptions for a search, mirrored so this module does not import xterm. */
export interface XtermSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  incremental?: boolean;
  decorations: FindDecorations;
}

export function searchOptions(options: TerminalFindOptions, decorations: FindDecorations, incremental = false): XtermSearchOptions {
  const result: XtermSearchOptions = {
    caseSensitive: options.matchCase,
    wholeWord: options.wholeWords,
    regex: options.regex,
    decorations,
  };
  if (incremental) {
    result.incremental = true;
  }
  return result;
}

/**
 * Highlight colors like the editor's find (the warning token over the terminal
 * background), made opaque because the addon draws them as solid boxes.
 */
export function findDecorations(readToken: (token: string) => string): FindDecorations {
  const background = (readToken("--term-background") ?? "").trim() || (readToken("--editor-bg") ?? "").trim() || "#ffffff";
  const warning = (readToken("--warning") ?? "").trim() || "#e5a50a";
  const match = toHex(composite(withAlpha(warning, 0.3), toHex(background)));
  const active = toHex(composite(withAlpha(warning, 0.62), toHex(background)));
  const border = mix(toHex(background), toHex(warning), 0.85);
  return {
    matchBackground: match,
    matchBorder: match,
    matchOverviewRuler: toHex(warning),
    activeMatchBackground: active,
    activeMatchBorder: border,
    activeMatchColorOverviewRuler: border,
  };
}

/** Why a regex query cannot be searched, or null when it can (or regex is off). */
export function findQueryError(query: string, options: TerminalFindOptions): string | null {
  if (!options.regex || query === "") {
    return null;
  }
  try {
    new RegExp(query);
    return null;
  } catch {
    return "Invalid regular expression";
  }
}

export interface FindResults {
  /** 0-based index of the selected match, or -1 when none is selected. */
  resultIndex: number;
  resultCount: number;
}

/** The counter beside the field: "3 of 12", "No results", or empty before typing. */
export function findCounterText(query: string, results: FindResults | null, error: string | null): string {
  if (error) {
    return error;
  }
  if (query === "" || !results) {
    return "";
  }
  if (results.resultCount === 0) {
    return "No results";
  }
  const total = results.resultCount >= FIND_HIGHLIGHT_LIMIT ? `${FIND_HIGHLIGHT_LIMIT}+` : `${results.resultCount}`;
  if (results.resultIndex < 0) {
    return `${total} found`;
  }
  return `${results.resultIndex + 1} of ${total}`;
}

/** What a key pressed in the find field does. */
export type FindBarKey = "previous" | "next" | "close" | "toggleCase" | "toggleWords" | "toggleRegex" | null;

/** The parts of a KeyboardEvent the find bar needs. */
export interface FindKey {
  key: string;
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

/**
 * Enter goes up to older output and Shift+Enter down,
 * because the newest output is at the bottom. Option+C, W and X toggle the
 * options like the editor's find bar (by the physical key, since Option types
 * other characters on a Mac).
 */
export function findBarKey(event: FindKey): FindBarKey {
  if (event.key === "Escape") {
    return "close";
  }
  if (event.key === "Enter" && !event.altKey && !event.metaKey && !event.ctrlKey) {
    return event.shiftKey ? "next" : "previous";
  }
  if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
    if (event.code === "KeyC") {
      return "toggleCase";
    }
    if (event.code === "KeyW") {
      return "toggleWords";
    }
    if (event.code === "KeyX") {
      return "toggleRegex";
    }
  }
  return null;
}
