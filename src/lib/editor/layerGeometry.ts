// Where text sits in a CodeMirror layer's coordinates, for markers that line up with columns
// (the indent guides and the right margin line). Read only while CodeMirror measures.

import type { EditorView } from "@codemirror/view";

/** CodeMirror's default left padding of a line, used until a line has been drawn. */
const LINE_PADDING = 6;

function linePadding(view: EditorView): number {
  const line = view.contentDOM.querySelector(".cm-line");
  const padding = line ? parseFloat(getComputedStyle(line).paddingLeft) : NaN;
  return Number.isFinite(padding) ? padding : LINE_PADDING;
}

/** Left edge of column 0 and top of the document, relative to the scrolled content like CodeMirror's own layers. */
export function textOrigin(view: EditorView): { left: number; top: number } {
  const scroller = view.scrollDOM.getBoundingClientRect();
  const content = view.contentDOM.getBoundingClientRect();
  const originLeft = scroller.left - view.scrollDOM.scrollLeft * view.scaleX;
  const originTop = scroller.top - view.scrollDOM.scrollTop * view.scaleY;
  return {
    left: (content.left - originLeft) / view.scaleX + linePadding(view),
    top: (view.documentTop - originTop) / view.scaleY,
  };
}
