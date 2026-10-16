// The changes of the side by side diff as lines, like JetBrains IDEs draw them: each side keeps its own lines (no
// padding), a band joins a change's lines on both sides, and scrolling maps lines through the changes.
import type { Chunk } from "@codemirror/merge";
import type { Text } from "@codemirror/state";
import type { ConnectorRibbon } from "@git-manager/ui/components/MergeConnector.svelte";
import type { Anchor } from "$lib/merge/model";

/** Lines [start, end) of one side, 0-based; an empty range is the gap before line `start`. */
export interface LineRange {
  start: number;
  end: number;
}

function sideLines(doc: Text, from: number, to: number): LineRange {
  // An empty change after the end of the text sits after the last line.
  if (from > doc.length) {
    return { start: doc.lines, end: doc.lines };
  }
  const first = doc.lineAt(from);
  // A chunk starts at a line start; an empty one at the end of the last line sits after it.
  const start = from === first.from ? first.number - 1 : first.number;
  if (from === to) {
    return { start, end: start };
  }
  // `to` is past the chunk's last line break, or one past the end when it ends at the end of the text.
  const last = doc.lineAt(Math.min(Math.max(from, to - 1), doc.length));
  return { start, end: last.number };
}

export function chunkLines(chunk: Chunk, a: Text, b: Text): { a: LineRange; b: LineRange } {
  return { a: sideLines(a, chunk.fromA, chunk.toA), b: sideLines(b, chunk.fromB, chunk.toB) };
}

export function chunkKind(chunk: Chunk): ConnectorRibbon["kind"] {
  if (chunk.fromA === chunk.toA) {
    return "added";
  }
  return chunk.fromB === chunk.toB ? "deleted" : "modified";
}

/** Line anchors from the left side to the right one: the edges of every change and of the texts. */
export function diffAnchors(chunks: readonly Chunk[], a: Text, b: Text): Anchor[] {
  const anchors: Anchor[] = [[0, 0]];
  for (const chunk of chunks) {
    const lines = chunkLines(chunk, a, b);
    anchors.push([lines.a.start, lines.b.start], [lines.a.end, lines.b.end]);
  }
  anchors.push([a.lines, b.lines]);
  return anchors;
}

/**
 * The edit that copies a change from one side over the other (stage or unstage), the same as @codemirror/merge's
 * revert controls: the chunk's lines with their line break, unless they end the text.
 */
export function copyChange(
  chunk: Chunk,
  toA: boolean,
  a: Text,
  b: Text,
): { target: "a" | "b"; from: number; to: number; insert: string } {
  const [source, dest, sourceFrom, sourceTo, destFrom, destTo] = toA
    ? [b, a, chunk.fromB, chunk.toB, chunk.fromA, chunk.toA]
    : [a, b, chunk.fromA, chunk.toA, chunk.fromB, chunk.toB];
  let insert = source.sliceString(sourceFrom, Math.max(sourceFrom, sourceTo - 1));
  if (sourceFrom !== sourceTo && destTo <= dest.length) {
    insert += "\n";
  }
  return { target: toA ? "a" : "b", from: destFrom, to: Math.min(dest.length, destTo), insert };
}
