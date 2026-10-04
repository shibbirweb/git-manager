// Words of the document for completion. CodeMirror's completeAnyWord scans the whole file every
// time a word starts and stops caching once it has seen 2000 words, which costs tens of
// milliseconds on a large file. This reads only the lines around the cursor, nearest first, and
// keeps a bounded list, so a keystroke costs the same in a 100 000 line file as in a short one.

import type { Text } from "@codemirror/state";

/** Lines read above and below the cursor. */
export const WINDOW_LINES = 1500;
/** At most this many words are offered; the completion list filters them as you type. */
export const MAX_WORDS = 400;

const patterns = new Map<string, RegExp>();

/** What counts as a word, as in completeAnyWord: letters, digits, `_` and the language's own word characters. */
export function wordPattern(wordChars: string): RegExp {
  let pattern = patterns.get(wordChars);
  if (!pattern) {
    const escaped = wordChars.replace(/[\]\-\\]/g, "\\$&");
    try {
      pattern = new RegExp(`[\\p{Alphabetic}\\p{Number}_${escaped}]+`, "gu");
    } catch {
      pattern = new RegExp(`[\\w${escaped}]+`, "g");
    }
    patterns.set(wordChars, pattern);
  }
  return pattern;
}

/**
 * The distinct words near `pos`, nearest lines first, skipping the word being typed (the one
 * starting at `ignoreAt`; -1 skips none).
 */
export function windowWords(doc: Text, pos: number, pattern: RegExp, ignoreAt = pos): string[] {
  const cursorLine = doc.lineAt(pos);
  const first = Math.max(1, cursorLine.number - WINDOW_LINES);
  const last = Math.min(doc.lines, cursorLine.number + WINDOW_LINES);
  const lines: string[] = [];
  for (const line of doc.iterLines(first, last + 1)) {
    lines.push(line);
  }
  const cursorIndex = cursorLine.number - first;
  const skipColumn = ignoreAt >= cursorLine.from && ignoreAt <= cursorLine.to ? ignoreAt - cursorLine.from : -1;
  const words: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  /** Takes the words of one line; true once the list is full. */
  const collect = (index: number): boolean => {
    if (index < 0 || index >= lines.length) {
      return false;
    }
    re.lastIndex = 0;
    for (let match = re.exec(lines[index]); match; match = re.exec(lines[index])) {
      const word = match[0];
      if (seen.has(word) || (index === cursorIndex && match.index === skipColumn)) {
        continue;
      }
      seen.add(word);
      words.push(word);
      if (words.length >= MAX_WORDS) {
        return true;
      }
    }
    return false;
  };
  // The cursor line, then the lines next to it, moving outward.
  for (let step = 0; cursorIndex + step < lines.length || cursorIndex - step >= 0; step++) {
    if (collect(cursorIndex + step) || (step > 0 && collect(cursorIndex - step))) {
      break;
    }
  }
  return words;
}
