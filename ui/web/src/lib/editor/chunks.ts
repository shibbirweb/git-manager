// Tints a merge pane's chunk lines (MergeView): a decoration set rebuilt when the chunks change, from the line
// ranges of the pane's side.
import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { chunkLineClasses, type MergeChunk } from "../logic/mergeGeometry";

export type ChunkSide = "left" | "result" | "right";

export const setChunks = StateEffect.define<MergeChunk[]>();

function decorations(view: { state: EditorView["state"] }, chunks: MergeChunk[], side: ChunkSide): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const lines = view.state.doc.lines;
  const ranges = chunks
    .map((chunk) => ({ kind: chunk.kind, range: chunk[side] }))
    .sort((left, right) => left.range[0] - right.range[0]);
  for (const { kind, range } of ranges) {
    for (let line = range[0]; line < range[1] && line < lines; line++) {
      const from = view.state.doc.line(line + 1).from;
      builder.add(from, from, Decoration.line({ class: chunkLineClasses(kind, range[0], range[1], line) }));
    }
  }
  return builder.finish();
}

export function chunkDecorations(side: ChunkSide, initial: MergeChunk[]): Extension {
  return StateField.define<{ chunks: MergeChunk[]; set: DecorationSet }>({
    create: (state) => ({ chunks: initial, set: decorations({ state }, initial, side) }),
    update(value, transaction) {
      const next = transaction.effects.find((effect) => effect.is(setChunks))?.value as MergeChunk[] | undefined;
      if (next || transaction.docChanged) {
        const chunks = next ?? value.chunks;
        return { chunks, set: decorations({ state: transaction.state }, chunks, side) };
      }
      return value;
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.set),
  });
}
