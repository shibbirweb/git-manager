// The right margin line: one
// thin line at a column, drawn as a single marker in a CodeMirror layer above the text.
// With the setting off, the extension is not in the editor at all.

import type { Extension } from "@codemirror/state";
import { EditorView, layer, RectangleMarker, type ViewUpdate } from "@codemirror/view";
import { textOrigin } from "./layerGeometry";

/** Left edge of `column`, in pixels from the start of the line's text. */
export function rulerOffset(column: number, characterWidth: number): number {
  return Math.max(0, column) * characterWidth;
}

function markers(view: EditorView, column: number): readonly RectangleMarker[] {
  const left = textOrigin(view).left + rulerOffset(column, view.defaultCharacterWidth);
  const height = Math.max(view.contentHeight / view.scaleY, view.scrollDOM.clientHeight);
  return [new RectangleMarker("cm-gm-ruler", left, 0, null, height)];
}

const theme = EditorView.baseTheme({
  ".cm-gm-rulerLayer": {
    pointerEvents: "none",
  },
  ".cm-gm-ruler": {
    borderLeft: "1px solid color-mix(in srgb, var(--text-faint) 45%, transparent)",
  },
});

/** A margin line at `column` for an editor. */
export function rulerLine(column: number): Extension {
  return [
    layer({
      above: true,
      class: "cm-gm-rulerLayer",
      markers: (view) => markers(view, column),
      update: (update: ViewUpdate) => update.geometryChanged || update.viewportChanged,
    }),
    theme,
  ];
}
