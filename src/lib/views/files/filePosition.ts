// A file editor's place in its text: going to a line or to the next change or conflict (F7), back to where a tab
// was, new text from disk that keeps the caret, and what the status bar shows.
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorIndent } from "$lib/editor/indentation";
import type { ChangeMark } from "$lib/editor/lineDiff";
import { sectionTarget } from "$lib/editor/navigation";
import { reloadChange } from "$lib/editor/reloadChange";
import { languageName } from "$lib/editor/setup";
import { editorTopLine } from "$lib/markdown/editorScroll";
import type { EditorInfo } from "$lib/stores/editorStatus.svelte";
import type { Eol } from "$lib/types";

export interface TabPosition {
  line: number;
  column: number;
  topLine: number;
}

/** Moves the cursor to a 0-based line (and column) and centers it. */
export function revealLine(view: EditorView, line: number, column = 0): void {
  const doc = view.state.doc;
  const target = doc.line(Math.max(1, Math.min(line + 1, doc.lines)));
  const position = target.from + Math.max(0, Math.min(column, target.length));
  view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
}

/** The caret's 0-based line. */
export function cursorLine(view: EditorView): number {
  return view.state.doc.lineAt(view.state.selection.main.head).number - 1;
}

/** Goes to the next (1) or previous (-1) change or conflict from the caret; false when there is none. */
export function goToSection(view: EditorView, marks: ChangeMark[], direction: 1 | -1): boolean {
  const target = sectionTarget(marks, cursorLine(view), direction);
  if (!target) {
    return false;
  }
  const doc = view.state.doc;
  const position = doc.line(Math.min(target.from + 1, doc.lines)).from;
  view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
  view.focus();
  return true;
}

/** "2 of 5", "5 changes", "3 sections" (with conflicts), or "No changes". */
export function sectionLabel(count: number, index: number, conflicts: boolean): string {
  if (count === 0) {
    return "No changes";
  }
  const noun = conflicts ? "sections" : count === 1 ? "change" : "changes";
  return index >= 0 ? `${index + 1} of ${count}` : `${count} ${noun}`;
}

/** The caret and top line, for Reopen tabs on start and Reopen Closed Tab; a hidden editor measures no top line. */
export function currentPosition(view: EditorView): { line: number; column: number; topLine: number | null } {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const visible = view.scrollDOM.clientHeight > 0;
  return { line: line.number - 1, column: head - line.from, topLine: visible ? editorTopLine(view) : null };
}

/** Puts the caret and scroll back where a restored or reopened tab was. */
export function restorePosition(view: EditorView, position: TabPosition): void {
  const doc = view.state.doc;
  const target = doc.line(Math.max(1, Math.min(position.line + 1, doc.lines)));
  const top = doc.line(Math.max(1, Math.min(Math.floor(position.topLine) + 1, doc.lines)));
  view.dispatch({
    selection: { anchor: target.from + Math.min(position.column, target.length) },
    effects: EditorView.scrollIntoView(top.from, { y: "start" }),
  });
}

/**
 * Puts the text read from disk into the editor, replacing only the changed part so the caret and scroll stay;
 * scrolled to the end, a growing log is followed. False when the text was the same.
 */
export function applyDiskText(view: EditorView, content: string): boolean {
  const previousText = view.state.doc.toString();
  const change = reloadChange(previousText, content);
  if (!change) {
    return false;
  }
  const scroller = view.scrollDOM;
  const following =
    change.to === previousText.length && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
  view.dispatch({ changes: change });
  if (following) {
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.length, { y: "end" }) });
  }
  return true;
}

/** The caret, selection, line endings, indentation and language for the status bar. */
export function editorStatusOf(state: EditorState, filePath: string, eol: Eol): EditorInfo {
  const selection = state.selection.main;
  const line = state.doc.lineAt(selection.head);
  return {
    filePath,
    line: line.number,
    column: selection.head - line.from + 1,
    selected: selection.to - selection.from,
    selectedLines: selection.empty
      ? 0
      : state.doc.lineAt(selection.to).number - state.doc.lineAt(selection.from).number + 1,
    eol,
    tabSize: state.tabSize,
    indentTabs: editorIndent(state).useTabs,
    indentDetected: editorIndent(state).detected,
    language: languageName(filePath),
  };
}

/** "12.5 KB" for the too large and binary messages. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
