// The lines one change covers, for its Revert button: the backend sends them back to the staged version with
// the same call as Discard Selected Lines, which checks the file did not change in the meantime.
import type { LineHunk, LineSelection } from "$lib/types";

/** The parts of a CodeMirror document the mapping needs (`Text` has them). */
export interface ChunkDoc {
  length: number;
  lineAt(position: number): { number: number };
}

/** A side of a split diff's chunk: its `from` and `to` (one past its last line break, maybe past the end). */
export function chunkLines(doc: ChunkDoc, from: number, to: number): [number, number] | null {
  if (to <= from) {
    return null;
  }
  const first = doc.lineAt(Math.min(from, doc.length)).number - 1;
  const last = doc.lineAt(Math.min(to - 1, doc.length)).number;
  return [first, Math.max(first + 1, last)];
}

/** A split diff's chunk as old (left) and new (right) lines. */
export function chunkSelection(
  chunk: { fromA: number; toA: number; fromB: number; toB: number },
  docA: ChunkDoc,
  docB: ChunkDoc,
): LineSelection {
  const oldLines = chunkLines(docA, chunk.fromA, chunk.toA);
  const newLines = chunkLines(docB, chunk.fromB, chunk.toB);
  return { oldLines: oldLines ? [oldLines] : [], newLines: newLines ? [newLines] : [] };
}

/** An inline diff's change: its hunk's old and new lines. */
export function hunkSelection(hunk: LineHunk): LineSelection {
  const [oldStart, oldEnd, newStart, newEnd] = hunk;
  return {
    oldLines: oldEnd > oldStart ? [[oldStart, oldEnd]] : [],
    newLines: newEnd > newStart ? [[newStart, newEnd]] : [],
  };
}
