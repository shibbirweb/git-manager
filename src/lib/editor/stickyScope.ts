// Sticky scroll without CodeMirror: which lines stay pinned above the file editor for the
// line at the top of the screen. stickyScroll.ts finds the blocks with the syntax tree and
// draws them; the indentation and markdown heading rules here cover files without one.

import { indentColumns } from "./indentGuides";

/** Pinned lines at most, like VS Code's editor.stickyScroll.maxLineCount. */
export const MAX_STICKY_LINES = 5;

/** How many lines the indentation and heading rules look back from the top line. */
export const MAX_SCOPE_SCAN = 2000;

/** A block of lines (1-based, inclusive) that holds the top line. */
export interface Scope {
  startLine: number;
  endLine: number;
}

export type LineText = (lineNumber: number) => string;

/** A line that only opens a block ("{", "[", "(" alone, Allman style) says nothing about it. */
export function onlyOpensBlock(text: string): boolean {
  return /^\s*[[{(]+\s*$/.test(text);
}

/**
 * The lines to pin when `topLine` is the first line under them: the first line of each
 * scope that started above it and is still open there, outermost first. A lone opening
 * bracket is replaced by the line before it, the one that names the block.
 */
export function headerLines(scopes: readonly Scope[], topLine: number, lineText: LineText, maxLines = MAX_STICKY_LINES): number[] {
  const starts = scopes
    .filter((scope) => scope.startLine < topLine && scope.endLine >= topLine)
    .map((scope) => scope.startLine)
    .sort((a, b) => a - b);
  const headers: number[] = [];
  for (const start of starts) {
    let line = start;
    const previous = headers[headers.length - 1] ?? 0;
    if (onlyOpensBlock(lineText(line))) {
      let above = line - 1;
      while (above > previous && lineText(above).trim() === "") {
        above--;
      }
      if (above > previous) {
        line = above;
      }
    }
    if (line > previous) {
      headers.push(line);
    }
    if (headers.length === maxLines) {
      break;
    }
  }
  return headers;
}

/**
 * Pinned lines for a scroll position. The pinned lines cover the first lines on screen, so
 * the line under them decides: `scopesAt(n)` gives the scopes around line n and
 * `lineAfter(count)` the line just below `count` pinned rows. Two passes settle it, like
 * VS Code, without a loop that could flicker.
 */
export function stickyLinesFor(
  topLine: number,
  scopesAt: (lineNumber: number) => readonly Scope[],
  lineAfter: (pinnedCount: number) => number,
  lineText: LineText,
  maxLines = MAX_STICKY_LINES,
): number[] {
  const first = headerLines(scopesAt(topLine), topLine, lineText, maxLines);
  if (first.length === 0) {
    return first;
  }
  const below = lineAfter(first.length);
  return headerLines(scopesAt(below), below, lineText, maxLines);
}

/**
 * Scopes by indentation, for files without a grammar: each line above with less indent than
 * the one before opens a scope. A blank top line takes the indent of the next code line.
 */
export function indentScopes(lineText: LineText, lineCount: number, lineNumber: number, tabSize: number, maxScan = MAX_SCOPE_SCAN): Scope[] {
  let indent: number | null = null;
  for (let line = lineNumber; line <= lineCount && line < lineNumber + maxScan && indent === null; line++) {
    indent = indentColumns(lineText(line), tabSize);
  }
  if (indent === null || indent === 0) {
    return [];
  }
  const scopes: Scope[] = [];
  for (let line = lineNumber - 1; line >= 1 && line >= lineNumber - maxScan && indent > 0; line--) {
    const columns = indentColumns(lineText(line), tabSize);
    if (columns !== null && columns < indent) {
      scopes.push({ startLine: line, endLine: lineNumber });
      indent = columns;
    }
  }
  return scopes.reverse();
}

/** Level of a markdown ATX heading ("## Title" is 2), or 0. */
export function headingLevel(text: string): number {
  const match = /^ {0,3}(#{1,6})(\s|$)/.exec(text);
  return match ? match[1].length : 0;
}

/**
 * Scopes by markdown headings: each heading above with a smaller level than the last one
 * found. A heading on the top line closes the sections of its own level and deeper.
 */
export function headingScopes(lineText: LineText, lineNumber: number, maxScan = MAX_SCOPE_SCAN): Scope[] {
  const scopes: Scope[] = [];
  let below = headingLevel(lineText(lineNumber)) || 7;
  for (let line = lineNumber - 1; line >= 1 && line >= lineNumber - maxScan && below > 1; line--) {
    const level = headingLevel(lineText(line));
    if (level > 0 && level < below) {
      scopes.push({ startLine: line, endLine: lineNumber });
      below = level;
    }
  }
  return scopes.reverse();
}
