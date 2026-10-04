// Editor commands CodeMirror does not ship, written against the state alone so they can be
// tested without a view: Duplicate, Join Lines, Toggle Case and Sort Lines (the Code
// menu), and parsing Go to Line's input. Each returns null when there is nothing to do.

import { EditorSelection, type EditorState, type SelectionRange, type TransactionSpec } from "@codemirror/state";

/** Duplicate Line or Selection: a selection is copied right after itself, a caret copies its line below. */
export function duplicateSelection(state: EditorState): TransactionSpec | null {
  if (state.readOnly) {
    return null;
  }
  const result = state.changeByRange((range) => {
    if (range.empty) {
      const line = state.doc.lineAt(range.head);
      const insert = state.lineBreak + line.text;
      return { changes: { from: line.to, insert }, range: EditorSelection.cursor(range.head + insert.length) };
    }
    const text = state.sliceDoc(range.from, range.to);
    const copy = forward(range)
      ? EditorSelection.range(range.to, range.to + text.length)
      : EditorSelection.range(range.to + text.length, range.to);
    return { changes: { from: range.to, insert: text }, range: copy };
  });
  return { ...result, scrollIntoView: true, userEvent: "input.copyline" };
}

function forward(range: SelectionRange): boolean {
  return range.head >= range.anchor;
}

/**
 * Join Lines: a caret joins its line with the next one, a selection joins every line it
 * touches. The line break and the indentation around it become one space (none next to a
 * blank line).
 */
export function joinLines(state: EditorState): TransactionSpec | null {
  if (state.readOnly) {
    return null;
  }
  const doc = state.doc;
  const joins = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = doc.lineAt(range.from).number;
    const last = doc.lineAt(range.to).number;
    if (first === last) {
      if (first < doc.lines) {
        joins.add(first);
      }
      continue;
    }
    for (let lineNumber = first; lineNumber < last; lineNumber++) {
      joins.add(lineNumber);
    }
  }
  if (joins.size === 0) {
    return null;
  }
  const changes = [...joins]
    .sort((a, b) => a - b)
    .map((lineNumber) => {
      const line = doc.line(lineNumber);
      const next = doc.line(lineNumber + 1);
      const trailing = line.text.length - line.text.trimEnd().length;
      const leading = next.text.length - next.text.trimStart().length;
      const blank = line.text.trim() === "" || next.text.trim() === "";
      return { from: line.to - trailing, to: next.from + leading, insert: blank ? "" : " " };
    });
  const changeSet = state.changes(changes);
  const ranges = state.selection.ranges.map((range) => {
    if (!range.empty) {
      return EditorSelection.range(changeSet.mapPos(range.anchor), changeSet.mapPos(range.head));
    }
    // The caret goes to the join point, after the text of its own line.
    const line = doc.lineAt(range.head);
    const end = line.to - (line.text.length - line.text.trimEnd().length);
    return EditorSelection.cursor(changeSet.mapPos(joins.has(line.number) ? end : range.head, -1));
  });
  return {
    changes: changeSet,
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    scrollIntoView: true,
    userEvent: "delete.join",
  };
}

/**
 * Toggle Case: upper case when the text has a lower case letter, lower case otherwise. A
 * caret works on the word it touches.
 */
export function toggleCase(state: EditorState): TransactionSpec | null {
  if (state.readOnly) {
    return null;
  }
  let changed = false;
  const result = state.changeByRange((range) => {
    const target = range.empty ? state.wordAt(range.head) : range;
    if (!target || target.empty) {
      return { range };
    }
    const text = state.sliceDoc(target.from, target.to);
    const next = text === text.toUpperCase() ? text.toLowerCase() : text.toUpperCase();
    if (next === text) {
      return { range };
    }
    changed = true;
    // Case changes can change the length ("ß" becomes "SS"): the selection covers the new text.
    const end = target.from + next.length;
    const selection = range.empty
      ? EditorSelection.cursor(Math.min(range.head, end))
      : forward(range)
        ? EditorSelection.range(target.from, end)
        : EditorSelection.range(end, target.from);
    return { changes: { from: target.from, to: target.to, insert: next }, range: selection };
  });
  return changed ? { ...result, userEvent: "input.case" } : null;
}

/** The lines a range covers; a selection ending at the start of a line leaves that line out. */
function lineSpan(state: EditorState, range: SelectionRange): { first: number; last: number } {
  const first = state.doc.lineAt(range.from).number;
  const endLine = state.doc.lineAt(range.to);
  const last = !range.empty && range.to === endLine.from && endLine.number > first ? endLine.number - 1 : endLine.number;
  return { first, last };
}

/**
 * Sort Lines: sorts the lines of each selection, or the whole document when nothing is
 * selected, by character code so the order never depends on the system language.
 */
export function sortLines(state: EditorState): TransactionSpec | null {
  if (state.readOnly) {
    return null;
  }
  const doc = state.doc;
  const selected = state.selection.ranges.filter((range) => !range.empty);
  const spans = selected.length > 0 ? selected.map((range) => lineSpan(state, range)) : [{ first: 1, last: doc.lines }];
  // Overlapping selections sort as one block.
  const merged: { first: number; last: number }[] = [];
  for (const span of spans.sort((a, b) => a.first - b.first)) {
    const previous = merged[merged.length - 1];
    if (previous && span.first <= previous.last) {
      previous.last = Math.max(previous.last, span.last);
    } else {
      merged.push({ ...span });
    }
  }
  const changes: { from: number; to: number; insert: string }[] = [];
  const ranges: SelectionRange[] = [];
  for (const span of merged) {
    if (span.last <= span.first) {
      continue;
    }
    const from = doc.line(span.first).from;
    const to = doc.line(span.last).to;
    const lines: string[] = [];
    for (let lineNumber = span.first; lineNumber <= span.last; lineNumber++) {
      lines.push(doc.line(lineNumber).text);
    }
    const sorted = [...lines].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    ranges.push(EditorSelection.range(from, to));
    if (sorted.some((text, index) => text !== lines[index])) {
      changes.push({ from, to, insert: sorted.join(state.lineBreak) });
    }
  }
  if (changes.length === 0) {
    return null;
  }
  return {
    changes,
    selection: EditorSelection.create(ranges),
    scrollIntoView: true,
    userEvent: "input.sort",
  };
}

export interface LineTarget {
  /** 1-based line, clamped to the document. */
  line: number;
  /** 1-based column. */
  column: number;
}

/** Go to Line input: "42" or "42:7" (line and column); null when it is not one. */
export function parseLineTarget(text: string, lineCount: number): LineTarget | null {
  const match = /^\s*(\d+)\s*(?:[:,]\s*(\d+)\s*)?$/.exec(text);
  if (!match) {
    return null;
  }
  const line = Number(match[1]);
  const column = match[2] === undefined ? 1 : Number(match[2]);
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column)) {
    return null;
  }
  return { line: Math.min(Math.max(1, line), Math.max(1, lineCount)), column: Math.max(1, column) };
}

/** Where a Go to Line target lands in the document; the column stops at the end of the line. */
export function lineTargetPosition(state: EditorState, target: LineTarget): number {
  const line = state.doc.line(Math.min(Math.max(1, target.line), state.doc.lines));
  return line.from + Math.min(target.column - 1, line.length);
}
