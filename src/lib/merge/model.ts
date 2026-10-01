// Pure merge-resolution state: chunk bookkeeping, line-level edits and the
// line mapping used for synchronized scrolling. No DOM or editor views here,
// so everything is unit-testable.

import type { ChangeSet, Text } from "@codemirror/state";
import type { ChunkKind, LineRange, MergeChunk, MergeDocument } from "$lib/types";

export type SideName = "ours" | "theirs";

export interface ChunkState {
  id: number;
  kind: ChunkKind;
  base: LineRange;
  ours: LineRange;
  theirs: LineRange;
  /** Lines this chunk currently occupies in the result document. */
  result: LineRange;
  /** The left (ours) side was applied or ignored. */
  oursDone: boolean;
  /** The right (theirs) side was applied or ignored. */
  theirsDone: boolean;
  /** The result already holds one applied side; the next apply appends. */
  applied: boolean;
  /** The user typed inside the chunk. */
  edited: boolean;
}

export interface LineEdit {
  from: number;
  to: number;
  insert: string;
}

export interface ChunkAction {
  changes: LineEdit[];
  chunks: ChunkState[];
}

export type ChangeType = "added" | "deleted" | "modified" | "conflict";

export function isResolved(chunk: ChunkState): boolean {
  return chunk.oursDone && chunk.theirsDone;
}

/** Whether a side introduced a change in this chunk (so it gets a connector). */
export function sideChanged(chunk: ChunkState, side: SideName): boolean {
  if (chunk.kind === "conflict" || chunk.kind === "bothSame") {
    return true;
  }
  return side === "ours" ? chunk.kind === "oursOnly" : chunk.kind === "theirsOnly";
}

export function sideRange(chunk: ChunkState, side: SideName): LineRange {
  return side === "ours" ? chunk.ours : chunk.theirs;
}

function rangeLength(range: LineRange): number {
  return range.end - range.start;
}

/** How a side's lines differ from the base, for coloring. */
export function changeType(chunk: ChunkState, side: SideName): ChangeType {
  if (chunk.kind === "conflict") {
    return "conflict";
  }
  const sideLength = rangeLength(sideRange(chunk, side));
  const baseLength = rangeLength(chunk.base);
  if (baseLength === 0) {
    return "added";
  }
  if (sideLength === 0) {
    return "deleted";
  }
  return "modified";
}

/** The color for a chunk in the result pane. */
export function resultChangeType(chunk: ChunkState): ChangeType {
  if (chunk.kind === "theirsOnly") {
    return changeType(chunk, "theirs");
  }
  return changeType(chunk, "ours");
}

export function initialChunks(chunks: MergeChunk[]): ChunkState[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    kind: chunk.kind,
    base: { ...chunk.base },
    ours: { ...chunk.ours },
    theirs: { ...chunk.theirs },
    result: { ...chunk.base },
    oursDone: chunk.kind === "theirsOnly",
    theirsDone: chunk.kind === "oursOnly",
    applied: false,
    edited: false,
  }));
}

export function splitLines(text: string): string[] {
  return text.split("\n");
}

export function sliceLines(lines: string[], range: LineRange): string[] {
  return lines.slice(range.start, range.end);
}

/**
 * Replaces the lines `range` of `doc` with `lines`, with exact line-array
 * semantics (the document is lines joined by "\n"), including edits at the
 * very end of the document.
 */
export function replaceLines(doc: Text, range: LineRange, lines: string[]): LineEdit | null {
  const lineCount = doc.lines;
  const lineFrom = (index: number) => doc.line(index + 1).from;
  const lineTo = (index: number) => doc.line(index + 1).to;

  if (range.start < range.end) {
    if (lines.length > 0) {
      return { from: lineFrom(range.start), to: lineTo(range.end - 1), insert: lines.join("\n") };
    }
    if (range.end < lineCount) {
      return { from: lineFrom(range.start), to: lineFrom(range.end), insert: "" };
    }
    if (range.start > 0) {
      return { from: lineTo(range.start - 1), to: doc.length, insert: "" };
    }
    return { from: 0, to: doc.length, insert: "" };
  }

  if (lines.length === 0) {
    return null;
  }
  if (range.start < lineCount) {
    const at = lineFrom(range.start);
    return { from: at, to: at, insert: `${lines.join("\n")}\n` };
  }
  return { from: doc.length, to: doc.length, insert: `\n${lines.join("\n")}` };
}

function shiftAfter(chunks: ChunkState[], index: number, delta: number): void {
  if (delta === 0) {
    return;
  }
  for (let later = index + 1; later < chunks.length; later++) {
    const chunk = chunks[later];
    chunks[later] = {
      ...chunk,
      result: { start: chunk.result.start + delta, end: chunk.result.end + delta },
    };
  }
}

export interface SideTexts {
  ours: string[];
  theirs: string[];
}

/**
 * Applies one side of a chunk. The first apply replaces the base lines; a
 * second apply on a conflict appends the other side (JetBrains behaviour).
 */
export function applySide(
  doc: Text,
  chunks: ChunkState[],
  chunkId: number,
  side: SideName,
  sides: SideTexts,
): ChunkAction | null {
  const index = chunks.findIndex((chunk) => chunk.id === chunkId);
  if (index < 0) {
    return null;
  }
  const chunk = chunks[index];
  const done = side === "ours" ? chunk.oursDone : chunk.theirsDone;
  if (done) {
    return null;
  }
  const lines = sliceLines(side === "ours" ? sides.ours : sides.theirs, sideRange(chunk, side));
  const next = chunks.slice();
  const append = chunk.applied && chunk.kind === "conflict";
  const target: LineRange = append ? { start: chunk.result.end, end: chunk.result.end } : chunk.result;
  const edit = replaceLines(doc, target, lines);
  const newResult: LineRange = append
    ? { start: chunk.result.start, end: chunk.result.end + lines.length }
    : { start: chunk.result.start, end: chunk.result.start + lines.length };
  const resolvesBoth = chunk.kind === "bothSame";
  next[index] = {
    ...chunk,
    result: newResult,
    oursDone: resolvesBoth || side === "ours" ? true : chunk.oursDone,
    theirsDone: resolvesBoth || side === "theirs" ? true : chunk.theirsDone,
    applied: true,
  };
  shiftAfter(next, index, rangeLength(newResult) - rangeLength(chunk.result));
  return { changes: edit ? [edit] : [], chunks: next };
}

/** Marks one side as handled without changing the result. */
export function ignoreSide(chunks: ChunkState[], chunkId: number, side: SideName): ChunkAction | null {
  const index = chunks.findIndex((chunk) => chunk.id === chunkId);
  if (index < 0) {
    return null;
  }
  const chunk = chunks[index];
  const next = chunks.slice();
  const resolvesBoth = chunk.kind === "bothSame";
  next[index] = {
    ...chunk,
    oursDone: resolvesBoth || side === "ours" ? true : chunk.oursDone,
    theirsDone: resolvesBoth || side === "theirs" ? true : chunk.theirsDone,
  };
  return { changes: [], chunks: next };
}

/**
 * Applies every unresolved non-conflicting chunk in one step. `only` limits
 * it to changes coming from one side. Edits are expressed against the
 * original document, as CodeMirror expects for a single transaction.
 */
export function applyNonConflicting(doc: Text, chunks: ChunkState[], sides: SideTexts, only?: SideName): ChunkAction | null {
  const changes: LineEdit[] = [];
  const next: ChunkState[] = [];
  let delta = 0;
  for (const chunk of chunks) {
    const shifted: ChunkState = {
      ...chunk,
      result: { start: chunk.result.start + delta, end: chunk.result.end + delta },
    };
    const side: SideName | null =
      chunk.kind === "oursOnly" ? "ours" : chunk.kind === "theirsOnly" ? "theirs" : chunk.kind === "bothSame" ? "ours" : null;
    const eligible =
      side !== null &&
      !isResolved(chunk) &&
      !chunk.edited &&
      (only === undefined || chunk.kind === "bothSame" || only === side);
    if (!eligible || side === null) {
      next.push(shifted);
      continue;
    }
    const lines = sliceLines(side === "ours" ? sides.ours : sides.theirs, sideRange(chunk, side));
    const edit = replaceLines(doc, chunk.result, lines);
    const previous = changes[changes.length - 1];
    if (edit && previous && edit.from < previous.to) {
      // Manual edits made this chunk touch the previous one; leave it for the user.
      next.push(shifted);
      continue;
    }
    if (edit) {
      changes.push(edit);
    }
    const start = chunk.result.start + delta;
    next.push({
      ...chunk,
      result: { start, end: start + lines.length },
      oursDone: true,
      theirsDone: true,
      applied: true,
    });
    delta += lines.length - rangeLength(chunk.result);
  }
  if (changes.length === 0 && next.every((chunk, index) => isResolved(chunk) === isResolved(chunks[index]))) {
    return null;
  }
  return { changes, chunks: next };
}

/** Replaces the whole result with one side and resolves everything. */
export function acceptWholeSide(doc: Text, chunks: ChunkState[], text: string, side: SideName): ChunkAction {
  const next = chunks.map((chunk) => ({
    ...chunk,
    result: { ...sideRange(chunk, side) },
    oursDone: true,
    theirsDone: true,
    applied: true,
  }));
  return { changes: [{ from: 0, to: doc.length, insert: text }], chunks: next };
}

interface EditSpan {
  startLine: number;
  endLine: number;
  delta: number;
}

/**
 * Maps chunk result ranges through a user edit. Edits inside a chunk grow or
 * shrink it and mark it edited; edits before it shift it.
 */
export function mapChunks(chunks: ChunkState[], changes: ChangeSet, oldDoc: Text): ChunkState[] {
  const edits: EditSpan[] = [];
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const startLine = oldDoc.lineAt(fromA).number - 1;
    const endLine = oldDoc.lineAt(toA).number - 1;
    edits.push({ startLine, endLine, delta: inserted.lines - 1 - (endLine - startLine) });
  });
  if (edits.length === 0) {
    return chunks;
  }
  return chunks.map((chunk) => {
    const { start, end } = chunk.result;
    const empty = start === end;
    let shiftBefore = 0;
    let newStart: number | null = null;
    let endDelta = 0;
    let edited = chunk.edited;
    for (const edit of edits) {
      if (edit.endLine < start) {
        shiftBefore += edit.delta;
        endDelta += edit.delta;
        continue;
      }
      const after = empty ? edit.startLine >= start : edit.startLine >= end;
      if (after) {
        continue;
      }
      if (newStart === null && edit.startLine < start) {
        newStart = edit.startLine + shiftBefore;
      }
      endDelta += edit.delta;
      edited = true;
    }
    const mappedStart = newStart ?? start + shiftBefore;
    const mappedEnd = Math.max(mappedStart, end + endDelta);
    if (mappedStart === start && mappedEnd === end && edited === chunk.edited) {
      return chunk;
    }
    return { ...chunk, result: { start: mappedStart, end: mappedEnd }, edited };
  });
}

export interface ResolutionCounts {
  changes: number;
  conflicts: number;
}

export function unresolvedCounts(chunks: ChunkState[]): ResolutionCounts {
  let changes = 0;
  let conflicts = 0;
  for (const chunk of chunks) {
    if (!isResolved(chunk)) {
      changes++;
      if (chunk.kind === "conflict") {
        conflicts++;
      }
    }
  }
  return { changes, conflicts };
}

export type Anchor = [source: number, target: number];

/** Line anchors mapping a side pane to the result pane. */
export function sideToResultAnchors(chunks: ChunkState[], side: SideName, sideLines: number, resultLines: number): Anchor[] {
  const anchors: Anchor[] = [[0, 0]];
  for (const chunk of chunks) {
    const range = sideRange(chunk, side);
    anchors.push([range.start, chunk.result.start], [range.end, chunk.result.end]);
  }
  anchors.push([sideLines, resultLines]);
  return anchors;
}

export function invertAnchors(anchors: Anchor[]): Anchor[] {
  return anchors.map(([source, target]) => [target, source]);
}

/** Piecewise-linear mapping of a fractional line position through anchors. */
export function mapLine(position: number, anchors: Anchor[]): number {
  if (anchors.length === 0) {
    return position;
  }
  let lower = anchors[0];
  let upper = anchors[anchors.length - 1];
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    if (anchor[0] <= position) {
      lower = anchor;
    }
    if (anchor[0] >= position) {
      upper = anchor;
      break;
    }
  }
  const span = upper[0] - lower[0];
  if (span <= 0) {
    return lower[1];
  }
  return lower[1] + ((position - lower[0]) * (upper[1] - lower[1])) / span;
}

/** Index of the next (or previous) unresolved chunk relative to a result line. */
export function findUnresolved(chunks: ChunkState[], fromLine: number, direction: 1 | -1): ChunkState | null {
  const open = chunks.filter((chunk) => !isResolved(chunk));
  if (open.length === 0) {
    return null;
  }
  if (direction === 1) {
    return open.find((chunk) => chunk.result.start > fromLine) ?? open[0];
  }
  for (let index = open.length - 1; index >= 0; index--) {
    if (open[index].result.start < fromLine) {
      return open[index];
    }
  }
  return open[open.length - 1];
}

export function documentFor(document: MergeDocument): SideTexts {
  return { ours: splitLines(document.ours), theirs: splitLines(document.theirs) };
}

const MARKER = /^(<{7}|>{7})(\s|$)|^={7}$/m;

export function hasConflictMarkers(text: string): boolean {
  return MARKER.test(text);
}
