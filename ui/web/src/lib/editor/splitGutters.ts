// Gutter colors for a side by side diff (CodeMirror's MergeView): each change colored through the line numbers, so
// it reads as one band with its text. CodeMirror adds its chunks after the editors exist, so the colors follow its
// chunk list instead of reading it once.
import { type Chunk, getChunks } from "@codemirror/merge";
import { type EditorState, type Extension, type RangeSet, StateField, type Text } from "@codemirror/state";
import { type GutterMarker, gutterLineClass } from "@codemirror/view";
import { chunkGutterClasses, type GutterChunk } from "./mergeGutters";

export type SplitSide = "a" | "b";

/** A chunk's lines on one side, 0-based [start, end), empty where that side has none; red old, green new tone. */
export function splitChunkLines(doc: Text, chunk: Chunk, side: SplitSide, index: number): GutterChunk {
  const from = Math.min(side === "a" ? chunk.fromA : chunk.fromB, doc.length);
  const to = Math.min(side === "a" ? chunk.toA : chunk.toB, doc.length + 1);
  const start = doc.lineAt(from).number - 1;
  const end = to > from ? doc.lineAt(Math.max(from, Math.min(to - 1, doc.length))).number : start;
  const kind = chunk.fromA === chunk.toA ? "added" : chunk.fromB === chunk.toB ? "deleted" : "modified";
  return { index, kind, start, end, tone: side === "a" ? "old" : "new" };
}

/** Every change of the diff on one side, indexed like CodeMirror's chunk list. */
export function splitChunks(state: EditorState, side: SplitSide): GutterChunk[] {
  return (getChunks(state)?.chunks ?? []).map((chunk, index) => splitChunkLines(state.doc, chunk, side, index));
}

/** The gutter rows of one side's changes, in their colors (mergeGutterTheme, or the app's red and green). */
export function splitGutterColors(side: SplitSide): Extension {
  return StateField.define<RangeSet<GutterMarker>>({
    create: (state) => chunkGutterClasses(state.doc, splitChunks(state, side)),
    update(value, transaction) {
      const changed = getChunks(transaction.state)?.chunks !== getChunks(transaction.startState)?.chunks;
      return changed || transaction.docChanged
        ? chunkGutterClasses(transaction.state.doc, splitChunks(transaction.state, side))
        : value;
    },
    provide: (field) => gutterLineClass.from(field),
  });
}
