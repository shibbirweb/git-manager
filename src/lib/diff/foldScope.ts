// The scope label of a diff fold, read from an editor state: the blocks around a line (sticky scroll's scope
// source: the syntax tree, markdown headings or indentation) named by foldLabel.ts.
import type { EditorState } from "@codemirror/state";
import { onlyOpensBlock } from "$lib/editor/stickyScope";
import { scopeSource } from "$lib/editor/stickyScroll";
import { fileNamespace, foldLabel } from "./foldLabel";

/** Lines at the top of a file searched for a namespace or package statement. */
const NAMESPACE_LINES = 200;

/** A block's first line, or the line before it when it only opens the block (a `{` under a signature). */
function headerText(state: EditorState, startLine: number): string {
  const text = state.doc.line(startLine).text;
  return onlyOpensBlock(text) && startLine > 1 ? state.doc.line(startLine - 1).text : text;
}

function namespaceOf(state: EditorState): string | null {
  const last = Math.min(state.doc.lines, NAMESPACE_LINES);
  for (let line = 1; line <= last; line++) {
    const found = fileNamespace(state.doc.line(line).text);
    if (found) {
      return found;
    }
  }
  return null;
}

/** "namespace > class > method()" around line `lineNumber` (1-based), or null when no declaration encloses it. */
export function scopeLabelAt(state: EditorState, lineNumber: number): string | null {
  const line = Math.max(1, Math.min(lineNumber, state.doc.lines));
  const scopes = [...scopeSource(state)(line)].sort((a, b) => a.startLine - b.startLine);
  const headers = scopes.map((scope) => headerText(state, scope.startLine));
  // The namespace is read only when a declaration encloses the line, since it needs a scan of the file's top.
  return foldLabel(headers, null) === null ? null : foldLabel(headers, namespaceOf(state));
}
