// Finds git conflict markers in a document and resolves them in place.
// Supports the default "merge" style and "diff3" / "zdiff3" (with a base
// section introduced by |||||||).

import type { ChangeSet, Text } from "@codemirror/state";
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
export function findConflicts(lines: Iterable<string>): ConflictRegion[] {
  const regions: ConflictRegion[] = [];
  let open: { start: number; label: string; baseMarker: number | null; separator: number | null } | null = null;
  let index = -1;
  for (const line of lines) {
    index++;
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
  // iterLines walks the text tree once; doc.line(n) per line would search it from the root.
  return findConflicts({ [Symbol.iterator]: () => doc.iterLines() });
}

const MARKER_STARTS = ["<<<<<<<", "|||||||", "=======", ">>>>>>>"];

/** A line that is, or with a few more characters could become, part of a region's structure. */
function mayBeMarker(line: string): boolean {
  const first = line.charCodeAt(0);
  if (first !== 60 && first !== 124 && first !== 61 && first !== 62) {
    return false;
  }
  return MARKER_STARTS.some((start) => line.startsWith(start));
}

/** Whether any whole line touched by `from..to` may be a marker. */
function rangeHasMarker(doc: Text, from: number, to: number): boolean {
  const first = doc.lineAt(from).number;
  const last = doc.lineAt(to).number;
  for (const line of doc.iterLines(first, last + 1)) {
    if (mayBeMarker(line)) {
      return true;
    }
  }
  return false;
}

/**
 * The regions after an edit. Lines the edit did not touch keep their text, so when no touched
 * line (before or after the edit) looks like a marker, the markers are the same lines as before
 * and only move: typing costs a look at the edited lines instead of a scan of the whole file.
 */
export function updateConflicts(regions: ConflictRegion[], changes: ChangeSet, oldDoc: Text, newDoc: Text): ConflictRegion[] {
  let touched = false;
  changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    touched ||= rangeHasMarker(oldDoc, fromA, toA) || rangeHasMarker(newDoc, fromB, toB);
  });
  if (touched) {
    return findConflictsInDoc(newDoc);
  }
  if (regions.length === 0) {
    return regions;
  }
  const map = (line: number) => newDoc.lineAt(changes.mapPos(oldDoc.line(line + 1).from)).number - 1;
  return regions.map((region) => ({
    ...region,
    start: map(region.start),
    baseMarker: region.baseMarker === null ? null : map(region.baseMarker),
    separator: map(region.separator),
    end: map(region.end),
  }));
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
