// Selections drawn like PhpStorm's: soft rounded corners on the outside of the shape only. CodeMirror draws a
// selection as up to three boxes (the first line, the full lines between, the last line); rounding every box would
// cut notches where they meet, so a corner is rounded only when no neighbouring box carries on past it.
import type { Extension } from "@codemirror/state";
import { drawSelection, EditorView, layer, RectangleMarker } from "@codemirror/view";

export interface SelectionBox {
  left: number;
  top: number;
  width: number | null;
  height: number;
}

export type Corner = "tl" | "tr" | "bl" | "br";

/** Allowed gap between boxes that touch, in pixels (layout rounds positions). */
const TOUCH = 1.5;

function right(box: SelectionBox): number {
  return box.width === null ? Number.POSITIVE_INFINITY : box.left + box.width;
}

/** Whether `other` sits right above (`above`) or below the box and covers the area just inside the corner at x. */
function continues(box: SelectionBox, other: SelectionBox, above: boolean, x: number, inward: 1 | -1): boolean {
  const touching = above
    ? Math.abs(other.top + other.height - box.top) < TOUCH
    : Math.abs(box.top + box.height - other.top) < TOUCH;
  if (!touching) {
    return false;
  }
  const inside = x + inward;
  return other.left <= inside && right(other) >= inside;
}

/** The corners of each box (from one selection range) that lie on the outside of the shape. */
export function outerCorners(boxes: readonly SelectionBox[]): Corner[][] {
  return boxes.map((box) => {
    const others = boxes.filter((other) => other !== box);
    const covered = (above: boolean, x: number, inward: 1 | -1) =>
      others.some((other) => continues(box, other, above, x, inward));
    const corners: Corner[] = [];
    if (!covered(true, box.left, 1)) {
      corners.push("tl");
    }
    if (!covered(true, right(box), -1)) {
      corners.push("tr");
    }
    if (!covered(false, box.left, 1)) {
      corners.push("bl");
    }
    if (!covered(false, right(box), -1)) {
      corners.push("br");
    }
    return corners;
  });
}

// drawSelection's parts: its config, the cursor layer, the selection layer, the theme that hides the browser's
// selection and the facet saying it is hidden. Ours takes the selection layer's place (and its class), so an editor
// still has one selection layer; selection.test.ts checks the order still holds after a CodeMirror update.
const SELECTION_LAYER = 2;

const roundedLayer = layer({
  above: false,
  class: "cm-selectionLayer",
  markers(view) {
    return view.state.selection.ranges.flatMap((range) => {
      if (range.empty) {
        return [];
      }
      const boxes = RectangleMarker.forRange(view, "cm-selectionBackground", range);
      const corners = outerCorners(boxes);
      return boxes.map(
        (box, index) =>
          new RectangleMarker(
            ["cm-selectionBackground", ...corners[index].map((corner) => `cm-round-${corner}`)].join(" "),
            box.left,
            box.top,
            box.width,
            box.height,
          ),
      );
    });
  },
  update(update) {
    return update.docChanged || update.selectionSet || update.viewportChanged;
  },
});

const radius = "var(--code-editor-selection-radius, 3px)";

const roundedTheme = EditorView.baseTheme({
  ".cm-selectionLayer .cm-round-tl": { borderTopLeftRadius: radius },
  ".cm-selectionLayer .cm-round-tr": { borderTopRightRadius: radius },
  ".cm-selectionLayer .cm-round-bl": { borderBottomLeftRadius: radius },
  ".cm-selectionLayer .cm-round-br": { borderBottomRightRadius: radius },
});

/** drawSelection with rounded outer corners; the color still comes from the theme's .cm-selectionBackground. */
export function drawRoundedSelection(): Extension {
  const parts = drawSelection() as readonly Extension[];
  return [...parts.filter((_, index) => index !== SELECTION_LAYER), roundedLayer, roundedTheme];
}
