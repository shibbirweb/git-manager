// The current-line highlight, but only while nothing is selected. CodeMirror draws the
// selection behind the text, so an opaque line background would hide a selection made within
// one line (the cursor's line), so the highlight is dropped while selecting.

import type { EditorState, Extension } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

const activeLine = Decoration.line({ class: "cm-activeLine" });

/** Line starts to highlight: the cursor lines, when every range is empty; none otherwise. */
export function activeLineStarts(state: EditorState): number[] {
  if (state.selection.ranges.some((range) => !range.empty)) {
    return [];
  }
  const starts = new Set<number>();
  for (const range of state.selection.ranges) {
    starts.add(state.doc.lineAt(range.head).from);
  }
  return [...starts].sort((a, b) => a - b);
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const from of activeLineStarts(view.state)) {
    builder.add(from, from, activeLine);
  }
  return builder.finish();
}

export function highlightActiveLineWhenEmpty(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
