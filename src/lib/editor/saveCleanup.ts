// Clean-ups applied when a file is saved, like VS Code's files.trimTrailingWhitespace,
// files.insertFinalNewline and files.trimFinalNewlines (Settings > Editor > Saving). They are
// computed as one list of changes and applied as one transaction, so a single undo brings
// the text back. Pure apart from building that transaction.

import { isolateHistory } from "@codemirror/commands";
import type { EditorState, TransactionSpec } from "@codemirror/state";

export interface SaveCleanupOptions {
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
  trimFinalNewlines: boolean;
  /** Markdown keeps two or more trailing spaces: they are a hard line break there. */
  markdown: boolean;
  /**
   * 1-based lines that hold a caret. An auto save leaves them as they are, so the space just
   * typed before the next word is not taken away (VS Code does the same).
   */
  keepLines?: ReadonlySet<number>;
}

export interface CleanupChange {
  from: number;
  to: number;
  insert: string;
}

/** What the clean-up reads of the text: CodeMirror's `Text` fits. Lines are 1-based. */
export interface LineSource {
  readonly length: number;
  readonly lines: number;
  line(lineNumber: number): { from: number; to: number; text: string };
}

const TRAILING = /[ \t]+$/;

/** Length of the trailing spaces and tabs of `text` that should go. */
function trailingToTrim(text: string, markdown: boolean): number {
  const match = TRAILING.exec(text);
  if (!match) {
    return 0;
  }
  const run = match[0];
  // A Markdown hard line break: text, then two or more spaces.
  if (markdown && run.length >= 2 && !run.includes("\t") && run.length < text.length) {
    return 0;
  }
  return run.length;
}

export function hasSaveCleanup(options: SaveCleanupOptions): boolean {
  return options.trimTrailingWhitespace || options.insertFinalNewline || options.trimFinalNewlines;
}

/** The changes, in document order, that make the text follow `options`; empty when it already does. */
export function saveCleanupChanges(doc: LineSource, options: SaveCleanupOptions): CleanupChange[] {
  if (!hasSaveCleanup(options) || doc.length === 0) {
    return [];
  }
  const keep = options.keepLines ?? new Set<number>();
  const changes: CleanupChange[] = [];

  // The last line worth keeping: text, or a caret an auto save must not pull back.
  let lastLine = doc.lines;
  let cutFrom: number | null = null;
  if (options.trimFinalNewlines) {
    let content = 0;
    for (let lineNumber = doc.lines; lineNumber >= 1; lineNumber--) {
      if (doc.line(lineNumber).text.trim() !== "") {
        content = lineNumber;
        break;
      }
    }
    const caret = Math.max(0, ...[...keep].filter((lineNumber) => lineNumber <= doc.lines));
    const last = Math.max(content, caret);
    if (last + 1 <= doc.lines) {
      const from = doc.line(last + 1).from;
      if (from < doc.length) {
        cutFrom = from;
        lastLine = last;
      }
    }
  }

  if (options.trimTrailingWhitespace) {
    for (let lineNumber = 1; lineNumber <= lastLine; lineNumber++) {
      if (keep.has(lineNumber)) {
        continue;
      }
      const line = doc.line(lineNumber);
      const trim = trailingToTrim(line.text, options.markdown);
      if (trim > 0) {
        changes.push({ from: line.to - trim, to: line.to, insert: "" });
      }
    }
  }

  if (cutFrom !== null) {
    changes.push({ from: cutFrom, to: doc.length, insert: "" });
    // What is left ends with the newline of `lastLine`, or is empty.
    return changes;
  }

  if (options.insertFinalNewline) {
    const last = doc.line(doc.lines);
    const lastChange = changes[changes.length - 1];
    const trimmedLast = lastChange && lastChange.to === doc.length ? last.text.slice(0, lastChange.from - last.from) : last.text;
    const endsWithNewline = doc.lines > 1 && trimmedLast === "";
    const empty = doc.lines === 1 && trimmedLast === "";
    if (!endsWithNewline && !empty) {
      if (lastChange && lastChange.to === doc.length) {
        lastChange.insert = "\n";
      } else {
        changes.push({ from: doc.length, to: doc.length, insert: "\n" });
      }
    }
  }
  return changes;
}

/** Lines holding a caret or a selection's head, for an auto save. */
export function caretLines(state: EditorState): Set<number> {
  return new Set(state.selection.ranges.map((range) => state.doc.lineAt(range.head).number));
}

/**
 * The clean-up as one transaction, or null when there is nothing to change. It is its own
 * undo step, never merged with the typing before or after it; carets map through it.
 */
export function saveCleanupTransaction(state: EditorState, options: SaveCleanupOptions): TransactionSpec | null {
  const changes = saveCleanupChanges(state.doc, options);
  if (changes.length === 0) {
    return null;
  }
  return { changes, annotations: isolateHistory.of("full") };
}
