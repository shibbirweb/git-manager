// CodeMirror glue for the 3-way merge: the chunk state lives in a StateField
// of the result editor so it undoes/redoes together with the text.

import { invertedEffects } from "@codemirror/commands";
import { Prec, StateEffect, StateField, type Extension, type Range, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap } from "@codemirror/view";
import type { LineRange } from "$lib/types";
import type { TextSpan } from "./inline";
import {
  changeType,
  type ChangeType,
  type ChunkState,
  isResolved,
  mapChunks,
  resultChangeType,
  sideChanged,
  type SideName,
  sideRange,
} from "./model";

export const setChunks = StateEffect.define<ChunkState[]>();

export const chunkField = StateField.define<ChunkState[]>({
  create: () => [],
  update(value, tr) {
    // Several effects can arrive in one undo group; the last is the oldest state.
    let explicit: ChunkState[] | null = null;
    for (const effect of tr.effects) {
      if (effect.is(setChunks)) {
        explicit = effect.value;
      }
    }
    if (explicit) {
      return explicit;
    }
    if (tr.docChanged) {
      return mapChunks(value, tr.changes, tr.startState.doc);
    }
    return value;
  },
});

/** Records the previous chunk state for every change so undo restores it exactly. */
const chunkHistory = invertedEffects.of((tr) => {
  const before = tr.startState.field(chunkField, false);
  const after = tr.state.field(chunkField, false);
  if (!before || before === after) {
    return [];
  }
  return [setChunks.of(before)];
});

export interface LineMark {
  range: LineRange;
  type: ChangeType;
  /** Word-level changes, as offsets from the start of the range's first line. */
  inline?: TextSpan[] | null;
}

const inlineMark = Decoration.mark({ class: "cm-mc-inline" });

function lineDecorations(doc: Text, marks: LineMark[]): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const lineCount = doc.lines;
  for (const mark of marks) {
    const { start, end } = mark.range;
    if (start < end) {
      const last = Math.min(end, lineCount) - 1;
      for (let index = start; index <= last; index++) {
        const edge = start === last ? "cm-mc-single" : index === start ? "cm-mc-first" : index === last ? "cm-mc-last" : "";
        const line = doc.line(index + 1);
        decorations.push(Decoration.line({ class: `cm-mc-line cm-mc-${mark.type} ${edge}` }).range(line.from));
      }
      if (mark.inline && mark.inline.length > 0) {
        const blockFrom = doc.line(start + 1).from;
        const blockTo = doc.line(last + 1).to;
        for (const span of mark.inline) {
          const from = blockFrom + span.from;
          const to = Math.min(blockFrom + span.to, blockTo);
          if (from < to) {
            decorations.push(inlineMark.range(from, to));
          }
        }
      }
    } else if (start < lineCount) {
      const line = doc.line(start + 1);
      decorations.push(Decoration.line({ class: `cm-mc-gap-before cm-mc-edge-${mark.type}` }).range(line.from));
    } else {
      const line = doc.line(lineCount);
      decorations.push(Decoration.line({ class: `cm-mc-gap-after cm-mc-edge-${mark.type}` }).range(line.from));
    }
  }
  return Decoration.set(decorations, true);
}

export function resultMarks(chunks: ChunkState[]): LineMark[] {
  return chunks
    .filter((chunk) => !isResolved(chunk))
    .map((chunk) => ({ range: chunk.result, type: resultChangeType(chunk) }));
}

export function sideMarks(
  chunks: ChunkState[],
  side: SideName,
  inlineFor?: (chunk: ChunkState) => TextSpan[] | null,
): LineMark[] {
  return chunks
    .filter((chunk) => sideChanged(chunk, side) && !(side === "ours" ? chunk.oursDone : chunk.theirsDone))
    .map((chunk) => ({ range: sideRange(chunk, side), type: changeType(chunk, side), inline: inlineFor?.(chunk) ?? null }));
}

const resultDecorations = EditorView.decorations.compute([chunkField, "doc"], (state) =>
  lineDecorations(state.doc, resultMarks(state.field(chunkField))),
);

export const setSideMarks = StateEffect.define<LineMark[]>();

const sideMarkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSideMarks)) {
        return lineDecorations(tr.state.doc, effect.value);
      }
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const mergeTheme = EditorView.theme({
  ".cm-mc-line.cm-mc-modified": { backgroundColor: "var(--diff-modified)", "--mc-edge": "var(--diff-modified-edge)" },
  ".cm-mc-line.cm-mc-added": { backgroundColor: "var(--diff-added)", "--mc-edge": "var(--diff-added-edge)" },
  ".cm-mc-line.cm-mc-deleted": { backgroundColor: "var(--diff-deleted)", "--mc-edge": "var(--diff-deleted-edge)" },
  ".cm-mc-line.cm-mc-conflict": { backgroundColor: "var(--diff-conflict)", "--mc-edge": "var(--diff-conflict-edge)" },
  ".cm-mc-first": { boxShadow: "inset 0 1px 0 var(--mc-edge)" },
  ".cm-mc-last": { boxShadow: "inset 0 -1px 0 var(--mc-edge)" },
  ".cm-mc-single": { boxShadow: "inset 0 1px 0 var(--mc-edge), inset 0 -1px 0 var(--mc-edge)" },
  ".cm-mc-edge-modified": { "--mc-edge": "var(--diff-modified-edge)" },
  ".cm-mc-edge-added": { "--mc-edge": "var(--diff-added-edge)" },
  ".cm-mc-edge-deleted": { "--mc-edge": "var(--diff-deleted-edge)" },
  ".cm-mc-edge-conflict": { "--mc-edge": "var(--diff-conflict-edge)" },
  ".cm-mc-inline": { backgroundColor: "var(--diff-inline)", borderRadius: "2px" },
  ".cm-mc-gap-before": { boxShadow: "inset 0 2px 0 var(--mc-edge)" },
  ".cm-mc-gap-after": { boxShadow: "inset 0 -2px 0 var(--mc-edge)" },
  // Keep the active-line tint from hiding chunk colors.
  ".cm-activeLine.cm-mc-line": { backgroundImage: "linear-gradient(var(--editor-active-line), var(--editor-active-line))", backgroundBlendMode: "multiply" },
});

export function resultExtensions(initial: ChunkState[]): Extension[] {
  return [chunkField.init(() => initial), chunkHistory, resultDecorations, mergeTheme];
}

export function sideExtensions(): Extension[] {
  return [sideMarkField, mergeTheme];
}

/**
 * Cmd+Enter applies the merge from any pane. It must outrank the default keymap, where
 * Mod-Enter inserts a blank line in the editable result.
 */
export function applyKeymap(onApply: () => void): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: "Mod-Enter",
        scope: "editor search-panel",
        preventDefault: true,
        run: () => {
          onApply();
          return true;
        },
      },
    ]),
  );
}
