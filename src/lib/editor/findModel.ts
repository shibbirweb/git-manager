// Pure logic of the editor find and replace bar (findPanel.svelte.ts): the query built from
// the field and the toggles, the match counter, the selection that seeds the field and
// the ranges Select All Occurrences picks.

import { SearchQuery } from "@codemirror/search";
import type { EditorState } from "@codemirror/state";

export interface FindOptions {
  matchCase: boolean;
  wholeWords: boolean;
  regex: boolean;
}

export const DEFAULT_FIND_OPTIONS: FindOptions = { matchCase: false, wholeWords: false, regex: false };

/** The counter stops here so typing stays fast in huge files. */
export const COUNT_CAP = 10_000;
/** CodeMirror's own limit for selecting every match. */
export const SELECT_CAP = 1_000;
/** Longer selections do not seed the find field. */
export const MAX_SELECTION_QUERY = 500;

export type MatchTest = (match: string, state: EditorState, from: number, to: number) => boolean;

/**
 * The CodeMirror query for the field and toggles. Without Regex the text is literal,
 * so a typed \n stays two characters; with Regex the replacement understands \n, \t and $1.
 */
export function buildQuery(search: string, replace: string, options: FindOptions, test?: MatchTest): SearchQuery {
  return new SearchQuery({
    search,
    replace,
    caseSensitive: options.matchCase,
    wholeWord: options.wholeWords,
    regexp: options.regex,
    literal: !options.regex,
    test,
  });
}

export function optionsOf(query: SearchQuery): FindOptions {
  return { matchCase: query.caseSensitive, wholeWords: query.wholeWord, regex: query.regexp };
}

/** Why a regex query cannot be used, or null when it can (or Regex is off). */
export function regexError(search: string, regex: boolean): string | null {
  if (!regex || search === "") {
    return null;
  }
  try {
    // The flags CodeMirror compiles with.
    new RegExp(search, "gu");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid regular expression";
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The find field's text for a selection, or null to keep the previous query: only a short
 * selection on one line seeds it, escaped when Regex is on.
 */
export function selectionQuery(selected: string, regex: boolean): string | null {
  if (selected === "" || selected.length > MAX_SELECTION_QUERY || /[\r\n]/.test(selected)) {
    return null;
  }
  return regex ? escapeRegex(selected) : selected;
}

export interface MatchCount {
  /** Matches counted, at most `cap`. */
  total: number;
  /** There are more than `total`. */
  capped: boolean;
  /** 1-based index of the match the main selection covers, if any. */
  current: number | null;
}

export const NO_MATCHES: MatchCount = { total: 0, capped: false, current: null };

/** Counts the matches of `query`, stopping at `cap`, and finds the selected one. */
export function countMatches(state: EditorState, query: SearchQuery, cap = COUNT_CAP): MatchCount {
  if (!query.valid) {
    return NO_MATCHES;
  }
  const selection = state.selection.main;
  const cursor = query.getCursor(state);
  let total = 0;
  let current: number | null = null;
  for (let step = cursor.next(); !step.done; step = cursor.next()) {
    if (total >= cap) {
      return { total, capped: true, current };
    }
    total++;
    if (current === null && step.value.from === selection.from && step.value.to === selection.to) {
      current = total;
    }
  }
  return { total, capped: false, current };
}

export interface CounterView {
  text: string;
  /** No match, or an invalid regex: the field and counter turn red. */
  problem: boolean;
}

/** The counter beside the find field: "3/12", "12 results", "0 results" or "10000+". */
export function counterView(search: string, count: MatchCount, error: string | null): CounterView {
  if (error !== null) {
    return { text: "Invalid regex", problem: true };
  }
  if (search === "") {
    return { text: "", problem: false };
  }
  if (count.total === 0) {
    return { text: "0 results", problem: true };
  }
  const total = count.capped ? `${count.total}+` : `${count.total}`;
  if (count.current !== null) {
    return { text: `${count.current}/${total}`, problem: false };
  }
  if (count.capped) {
    return { text: total, problem: false };
  }
  return { text: `${total} ${count.total === 1 ? "result" : "results"}`, problem: false };
}

export interface OccurrenceRanges {
  ranges: { from: number; to: number }[];
  /** Index in `ranges` of the occurrence that was selected. */
  main: number;
  /** More than `cap`: nothing is selected. */
  tooMany: boolean;
}

/**
 * Select All Occurrences without a find query: every occurrence of the selection, or of the
 * word at the caret as a whole word, matched case-sensitively.
 */
export function occurrenceRanges(state: EditorState, cap = SELECT_CAP): OccurrenceRanges | null {
  const selection = state.selection.main;
  let from = selection.from;
  let to = selection.to;
  let wholeWord = false;
  if (from === to) {
    const word = state.wordAt(from);
    if (!word) {
      return null;
    }
    from = word.from;
    to = word.to;
    wholeWord = true;
  }
  const query = new SearchQuery({ search: state.sliceDoc(from, to), caseSensitive: true, literal: true, wholeWord });
  const ranges: { from: number; to: number }[] = [];
  let main = 0;
  const cursor = query.getCursor(state);
  for (let step = cursor.next(); !step.done; step = cursor.next()) {
    if (ranges.length >= cap) {
      return { ranges: [], main: 0, tooMany: true };
    }
    if (step.value.from === from) {
      main = ranges.length;
    }
    ranges.push({ from: step.value.from, to: step.value.to });
  }
  return ranges.length > 0 ? { ranges, main, tooMany: false } : null;
}

/** The first match at or after `anchor`, wrapping to the start: where typing jumps to. */
export function firstMatchFrom(state: EditorState, query: SearchQuery, anchor: number): { from: number; to: number } | null {
  if (!query.valid) {
    return null;
  }
  const after = query.getCursor(state, Math.min(anchor, state.doc.length)).next();
  if (!after.done) {
    return { from: after.value.from, to: after.value.to };
  }
  const wrapped = query.getCursor(state, 0, Math.min(state.doc.length, anchor + query.search.length)).next();
  return wrapped.done ? null : { from: wrapped.value.from, to: wrapped.value.to };
}

export interface Span {
  from: number;
  to: number;
}

/** Whether `[from, to)` is one of the excluded matches. */
export function isExcluded(excluded: readonly Span[], from: number, to: number): boolean {
  return excluded.some((span) => span.from === from && span.to === to);
}
