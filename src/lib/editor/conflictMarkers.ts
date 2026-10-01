// Finds git conflict markers in a document and resolves them in place.
// Supports the default "merge" style and "diff3" / "zdiff3" (with a base
// section introduced by |||||||).

import type { Text } from "@codemirror/state";
import { type LineEdit, replaceLines } from "$lib/merge/model";

export interface ConflictRegion {
  /** 0-based line of `<<<<<<<`. */
  start: number;
  /** 0-based line of `|||||||`, when the file uses diff3 style. */
  baseMarker: number | null;
  /** 0-based line of `=======`. */
  separator: number;
  /** 0-based line of `>>>>>>>`. */
  end: number;
  currentLabel: string;
  incomingLabel: string;
}

export type ConflictChoice = "current" | "incoming" | "both";

function markerLabel(line: string): string | null {
  const rest = line.slice(7);
  if (rest === "") {
    return "";
  }
  if (rest[0] === " " || rest[0] === "\t") {
    return rest.trim();
  }
  return null;
}

function isMarker(line: string, char: string): boolean {
  return line.startsWith(char.repeat(7)) && markerLabel(line) !== null;
}

/** Scans lines for complete conflict regions. Incomplete regions are skipped. */
export function findConflicts(lineCount: number, lineAt: (index: number) => string): ConflictRegion[] {
  const regions: ConflictRegion[] = [];
  let open: { start: number; label: string; baseMarker: number | null; separator: number | null } | null = null;
  for (let index = 0; index < lineCount; index++) {
    const line = lineAt(index);
    const first = line.charCodeAt(0);
    // Fast path: markers start with one of < | = >.
    if (first !== 60 && first !== 124 && first !== 61 && first !== 62) {
      continue;
    }
    if (isMarker(line, "<")) {
      open = { start: index, label: markerLabel(line) ?? "", baseMarker: null, separator: null };
    } else if (!open) {
      continue;
    } else if (isMarker(line, "|") && open.separator === null && open.baseMarker === null) {
      open.baseMarker = index;
    } else if (line === "=".repeat(7) && open.separator === null) {
      open.separator = index;
    } else if (isMarker(line, ">") && open.separator !== null) {
      regions.push({
        start: open.start,
        baseMarker: open.baseMarker,
        separator: open.separator,
        end: index,
        currentLabel: open.label,
        incomingLabel: markerLabel(line) ?? "",
      });
      open = null;
    }
  }
  return regions;
}

export function findConflictsInDoc(doc: Text): ConflictRegion[] {
  return findConflicts(doc.lines, (index) => doc.line(index + 1).text);
}

function sliceLines(doc: Text, from: number, to: number): string[] {
  const lines: string[] = [];
  for (let index = from; index < to; index++) {
    lines.push(doc.line(index + 1).text);
  }
  return lines;
}

export function currentLines(doc: Text, region: ConflictRegion): string[] {
  return sliceLines(doc, region.start + 1, region.baseMarker ?? region.separator);
}

export function incomingLines(doc: Text, region: ConflictRegion): string[] {
  return sliceLines(doc, region.separator + 1, region.end);
}

export function resolutionLines(doc: Text, region: ConflictRegion, choice: ConflictChoice): string[] {
  if (choice === "current") {
    return currentLines(doc, region);
  }
  if (choice === "incoming") {
    return incomingLines(doc, region);
  }
  return [...currentLines(doc, region), ...incomingLines(doc, region)];
}

/** The edit that replaces a whole region (markers included) with the chosen side. */
export function resolveEdit(doc: Text, region: ConflictRegion, choice: ConflictChoice): LineEdit | null {
  return replaceLines(doc, { start: region.start, end: region.end + 1 }, resolutionLines(doc, region, choice));
}

/** Edits resolving every region the same way, against the original document. */
export function resolveAllEdits(doc: Text, regions: ConflictRegion[], choice: ConflictChoice): LineEdit[] {
  const edits: LineEdit[] = [];
  for (const region of regions) {
    const edit = resolveEdit(doc, region, choice);
    const previous = edits[edits.length - 1];
    if (edit && (!previous || edit.from >= previous.to)) {
      edits.push(edit);
    }
  }
  return edits;
}
