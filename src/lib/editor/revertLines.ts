// Revert from the editor's change bars: which change against HEAD a clicked line belongs to, and the edit that
// puts HEAD's lines back. Lines are the editor's, 0-based; a text ending in a line break has an empty last line.
import type { Text } from "@codemirror/state";
import type { LineHunk } from "./lineDiff";

/** The change on `line`, or the deletion just above it (a deletion's bar sits on the next line's top edge). */
export function changeAtLine(hunks: readonly LineHunk[], line: number, docLines: number): LineHunk | null {
  for (const hunk of hunks) {
    if (hunk.newEnd > hunk.newStart) {
      if (line >= hunk.newStart && line < hunk.newEnd) {
        return hunk;
      }
    } else if (line === hunk.newStart || (hunk.newStart >= docLines && line === docLines - 1)) {
      return hunk;
    }
  }
  return null;
}

export interface LinesEdit {
  from: number;
  to: number;
  insert: string;
}

/** The edit that turns the change's lines in `doc` back into HEAD's `headLines` of it. */
export function revertEdit(doc: Text, hunk: LineHunk, headLines: readonly string[]): LinesEdit {
  const old = headLines.slice(hunk.oldStart, hunk.oldEnd).join("\n");
  const hasOld = hunk.oldEnd > hunk.oldStart;
  if (hunk.newEnd > hunk.newStart) {
    const start = doc.line(hunk.newStart + 1).from;
    const end = doc.line(hunk.newEnd).to;
    if (hasOld) {
      return { from: start, to: end, insert: old };
    }
    // An addition goes with one line break: its own, or the one before it at the end of the text.
    if (hunk.newEnd < doc.lines) {
      return { from: start, to: doc.line(hunk.newEnd + 1).from, insert: "" };
    }
    return hunk.newStart > 0
      ? { from: doc.line(hunk.newStart).to, to: end, insert: "" }
      : { from: 0, to: doc.length, insert: "" };
  }
  if (hunk.newStart < doc.lines) {
    const at = doc.line(hunk.newStart + 1).from;
    return { from: at, to: at, insert: `${old}\n` };
  }
  return { from: doc.length, to: doc.length, insert: `\n${old}` };
}
