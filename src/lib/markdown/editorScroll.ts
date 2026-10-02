// Reading and setting the editor's scroll position as a source line, for the
// Markdown preview's scroll sync. Lines are 0-based and fractional: 12.5 is
// halfway through line 13.

import type { EditorView } from "@codemirror/view";

/** Distance from the top of the document to the top of the visible area. */
function visibleTop(view: EditorView): number {
  return view.scrollDOM.getBoundingClientRect().top - view.documentTop;
}

/** The (fractional) line at the top of the editor. */
export function editorTopLine(view: EditorView): number {
  const height = Math.max(0, visibleTop(view));
  const block = view.lineBlockAtHeight(height);
  const line = view.state.doc.lineAt(block.from).number - 1;
  const fraction = block.height > 0 ? Math.min(1, Math.max(0, (height - block.top) / block.height)) : 0;
  return line + fraction;
}

/** Scrolls so a (fractional) line is at the top of the editor. */
export function scrollEditorToLine(view: EditorView, line: number): void {
  const doc = view.state.doc;
  const whole = Math.max(0, Math.min(doc.lines - 1, Math.floor(line)));
  const block = view.lineBlockAt(doc.line(whole + 1).from);
  const height = block.top + Math.min(1, Math.max(0, line - whole)) * block.height;
  const scroller = view.scrollDOM;
  scroller.scrollTop = height + (scroller.scrollTop - visibleTop(view));
}

/** The editor is scrolled to its end, where line mapping should give way to "end matches end". */
export function isScrolledToEnd(element: HTMLElement): boolean {
  return element.scrollHeight > element.clientHeight && element.scrollTop >= element.scrollHeight - element.clientHeight - 1;
}
