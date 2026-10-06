// The inline diff's document: both versions in one text, the removed lines of each change
// right above the lines that replace them. Every line remembers its number on each side, so
// the view can show two number columns, map a selection to old and new lines for the line
// actions, and find and select removed lines like any other text.

import { Chunk, diff } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import type { ChangeMark } from "$lib/editor/lineDiff";
import type { LineHunk, LineSelection } from "$lib/types";
import { SCAN_LIMIT } from "./hunkDiff";
import { type LineSpan, mergeRanges } from "./lineSelection";

export type InlineLineKind = "context" | "deleted" | "added";

export interface InlineLine {
  kind: InlineLineKind;
  /** 0-based line in the old text, null for an added line. */
  old: number | null;
  /** 0-based line in the new text, null for a removed line. */
  new: number | null;
}

/** One change: its removed lines, then its added lines, as 0-based half-open document lines. */
export interface InlineBlock {
  hunk: LineHunk;
  from: number;
  /** Where the added lines start; equal to `from` for a pure addition, to `to` for a pure removal. */
  split: number;
  to: number;
}

export interface InlineDoc {
  text: string;
  lines: InlineLine[];
  blocks: InlineBlock[];
  /** Per new line, its document line. */
  newToDoc: number[];
}

/** The texts as the diff splits them: LF only, a trailing newline leaves an empty last line. */
function splitLines(text: string): string[] {
  return text.split("\n");
}

export function buildInlineDoc(original: string, modified: string, hunks: readonly LineHunk[]): InlineDoc {
  const oldLines = splitLines(original);
  const newLines = splitLines(modified);
  const text: string[] = [];
  const lines: InlineLine[] = [];
  const blocks: InlineBlock[] = [];
  const newToDoc: number[] = [];
  let oldAt = 0;
  let newAt = 0;
  const context = (): void => {
    newToDoc[newAt] = lines.length;
    lines.push({ kind: "context", old: oldAt, new: newAt });
    text.push(newLines[newAt] ?? "");
    oldAt++;
    newAt++;
  };
  for (const hunk of hunks) {
    const [oldStart, oldEnd, newStart, newEnd] = hunk;
    while (oldAt < oldStart && newAt < newStart) {
      context();
    }
    const from = lines.length;
    for (; oldAt < oldEnd; oldAt++) {
      lines.push({ kind: "deleted", old: oldAt, new: null });
      text.push(oldLines[oldAt] ?? "");
    }
    const split = lines.length;
    for (; newAt < newEnd; newAt++) {
      newToDoc[newAt] = lines.length;
      lines.push({ kind: "added", old: null, new: newAt });
      text.push(newLines[newAt] ?? "");
    }
    blocks.push({ hunk, from, split, to: lines.length });
  }
  while (oldAt < oldLines.length && newAt < newLines.length) {
    context();
  }
  return { text: text.join("\n"), lines, blocks, newToDoc };
}

/** Line hunks from CodeMirror's own diff, for a payload without the backend's hunks. */
export function fallbackHunks(original: string, modified: string): LineHunk[] {
  const a = Text.of(splitLines(original));
  const b = Text.of(splitLines(modified));
  const lineOf = (doc: Text, position: number) => doc.lineAt(position).number - 1;
  return Chunk.build(a, b, { scanLimit: SCAN_LIMIT }).map((chunk): LineHunk => {
    const oldStart = lineOf(a, chunk.fromA);
    const newStart = lineOf(b, chunk.fromB);
    const oldEnd = chunk.toA > chunk.fromA ? lineOf(a, chunk.toA - 1) + 1 : oldStart;
    const newEnd = chunk.toB > chunk.fromB ? lineOf(b, chunk.toB - 1) + 1 : newStart;
    return [oldStart, oldEnd, newStart, newEnd];
  });
}

/**
 * The changed words of each modified change, as document ranges. Pure additions and removals
 * get none: their line color already says everything changed.
 */
export function inlineWordMarks(doc: InlineDoc): { from: number; to: number }[] {
  const docLines = doc.text.split("\n");
  const starts: number[] = [];
  let offset = 0;
  for (const line of docLines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const marks: { from: number; to: number }[] = [];
  for (const block of doc.blocks) {
    if (block.split === block.from || block.split === block.to) {
      continue;
    }
    // The removed lines and the added lines each sit together, so offsets in either block
    // text are offsets from the block's first line in the document.
    const removed = docLines.slice(block.from, block.split).join("\n");
    const added = docLines.slice(block.split, block.to).join("\n");
    for (const change of diff(removed, added, { scanLimit: SCAN_LIMIT })) {
      if (change.toA > change.fromA) {
        marks.push({ from: starts[block.from] + change.fromA, to: starts[block.from] + change.toA });
      }
      if (change.toB > change.fromB) {
        marks.push({ from: starts[block.split] + change.fromB, to: starts[block.split] + change.toB });
      }
    }
  }
  return marks.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** The old and new lines a selection picks: exactly the removed and added lines it covers. */
export function inlineSelection(doc: InlineDoc, spans: readonly LineSpan[]): LineSelection {
  const oldLines: [number, number][] = [];
  const newLines: [number, number][] = [];
  for (const [first, last] of spans) {
    for (let index = Math.max(0, first); index <= last && index < doc.lines.length; index++) {
      const line = doc.lines[index];
      if (line.kind === "deleted" && line.old !== null) {
        oldLines.push([line.old, line.old + 1]);
      } else if (line.kind === "added" && line.new !== null) {
        newLines.push([line.new, line.new + 1]);
      }
    }
  }
  return { oldLines: mergeRanges(oldLines), newLines: mergeRanges(newLines) };
}

/**
 * The full text of the index after one change is staged (the old text takes the new lines) or
 * unstaged (the new text takes the old lines back), like the side by side hunk buttons.
 */
export function applyBlock(
  original: string,
  modified: string,
  block: InlineBlock,
  action: "stage" | "unstage",
): { target: "original" | "modified"; text: string } {
  const oldLines = splitLines(original);
  const newLines = splitLines(modified);
  const [oldStart, oldEnd, newStart, newEnd] = block.hunk;
  if (action === "stage") {
    const text = [...oldLines.slice(0, oldStart), ...newLines.slice(newStart, newEnd), ...oldLines.slice(oldEnd)];
    return { target: "original", text: text.join("\n") };
  }
  const text = [...newLines.slice(0, newStart), ...oldLines.slice(oldStart, oldEnd), ...newLines.slice(newEnd)];
  return { target: "modified", text: text.join("\n") };
}

/** The overview ruler's ticks, in document lines. */
export function inlineChangeMarks(doc: InlineDoc): ChangeMark[] {
  return doc.blocks.map((block) => {
    if (block.split === block.from) {
      return { from: block.from, to: block.to, kind: "added" };
    }
    if (block.split === block.to) {
      return { from: block.from, to: block.to, kind: "deleted" };
    }
    return { from: block.from, to: block.to, kind: "modified" };
  });
}

/** The new text's line for a document line; a removed line counts as the line after it. */
export function newLineAt(doc: InlineDoc, docLine: number): number {
  for (let index = Math.max(0, docLine); index < doc.lines.length; index++) {
    const line = doc.lines[index].new;
    if (line !== null) {
      return line;
    }
  }
  return Math.max(0, doc.newToDoc.length - 1);
}

/** The document line of a new text line. */
export function docLineOf(doc: InlineDoc, newLine: number): number {
  return doc.newToDoc[Math.max(0, Math.min(newLine, doc.newToDoc.length - 1))] ?? 0;
}

/**
 * Runs of unchanged lines to fold, as half-open document lines: everything but `margin` lines
 * next to a change, when at least `minSize` lines would fold.
 */
export function collapsedRuns(doc: InlineDoc, margin: number, minSize: number): [number, number][] {
  const runs: [number, number][] = [];
  let index = 0;
  while (index < doc.lines.length) {
    if (doc.lines[index].kind !== "context") {
      index++;
      continue;
    }
    const start = index;
    while (index < doc.lines.length && doc.lines[index].kind === "context") {
      index++;
    }
    const from = start === 0 ? 0 : start + margin;
    const to = index === doc.lines.length ? index : index - margin;
    if (to - from >= minSize) {
      runs.push([from, to]);
    }
  }
  return runs;
}
