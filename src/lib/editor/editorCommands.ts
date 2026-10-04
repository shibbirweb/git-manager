// What the Edit and Code menu items do in the focused CodeMirror editor, and the keys the
// editor binds for them. The editor sees a key before the menu does (macOS hands key
// equivalents to the web view first), so a binding here and its menu item never both run:
// the menu item only fires when it is clicked or when no editor claimed the key.

import {
  deleteLine,
  indentLess,
  indentMore,
  moveLineDown,
  moveLineUp,
  redo,
  selectAll,
  toggleBlockComment,
  toggleComment,
  undo,
} from "@codemirror/commands";
import { foldAll, foldCode, unfoldAll, unfoldCode } from "@codemirror/language";
import { findNext, findPrevious, selectNextOccurrence } from "@codemirror/search";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { type Command, EditorView, type KeyBinding } from "@codemirror/view";
import type { EditorAction } from "$lib/menu/menuIds";
import { dialogs } from "$lib/ui/dialog.svelte";
import { EDITOR_SHORTCUTS } from "./editorShortcuts";
import { findCommand, replaceCommand, selectAllOccurrences } from "./findPanel.svelte";
import { duplicateSelection, joinLines, lineTargetPosition, parseLineTarget, sortLines, toggleCase } from "./textCommands";

function fromSpec(build: (state: EditorState) => TransactionSpec | null): Command {
  return (view) => {
    const spec = build(view.state);
    if (!spec) {
      return false;
    }
    view.dispatch(spec);
    return true;
  };
}

/** Go to Line: asks for "line" or "line:column" and moves the caret there. */
const goToLine: Command = (view) => {
  void promptGoToLine(view);
  return true;
};

async function promptGoToLine(view: EditorView): Promise<void> {
  const state = view.state;
  const head = state.selection.main.head;
  const current = state.doc.lineAt(head);
  const result = await dialogs.prompt({
    title: "Go to Line",
    label: `Line[:column] (1-${state.doc.lines})`,
    initial: `${current.number}:${head - current.from + 1}`,
    confirmLabel: "Go",
    validate: (value) => (parseLineTarget(value, state.doc.lines) ? null : "Enter a line number, optionally with :column"),
  });
  // The editor may have closed while the dialog was open.
  if (!view.dom.isConnected) {
    return;
  }
  const target = result ? parseLineTarget(result.value, view.state.doc.lines) : null;
  if (target) {
    const position = lineTargetPosition(view.state, target);
    view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
  }
  view.focus();
}

interface EditorCommandEntry {
  run: Command;
  /** Runs only with the caret in the text; Find and its friends also work from the find bar's fields. */
  inText: boolean;
}

export const EDITOR_COMMANDS: Record<EditorAction, EditorCommandEntry> = {
  "edit.find": { run: findCommand, inText: false },
  "edit.replace": { run: replaceCommand, inText: false },
  "edit.findNext": { run: findNext, inText: false },
  "edit.findPrevious": { run: findPrevious, inText: false },
  "edit.selectAllOccurrences": { run: selectAllOccurrences, inText: false },
  "code.lineComment": { run: toggleComment, inText: true },
  "code.blockComment": { run: toggleBlockComment, inText: true },
  "code.duplicate": { run: fromSpec(duplicateSelection), inText: true },
  "code.deleteLine": { run: deleteLine, inText: true },
  "code.joinLines": { run: fromSpec(joinLines), inText: true },
  "code.moveLineUp": { run: moveLineUp, inText: true },
  "code.moveLineDown": { run: moveLineDown, inText: true },
  "code.indent": { run: indentMore, inText: true },
  "code.unindent": { run: indentLess, inText: true },
  "code.toggleCase": { run: fromSpec(toggleCase), inText: true },
  "code.sortLines": { run: fromSpec(sortLines), inText: true },
  "code.expand": { run: unfoldCode, inText: true },
  "code.collapse": { run: foldCode, inText: true },
  "code.expandAll": { run: unfoldAll, inText: true },
  "code.collapseAll": { run: foldAll, inText: true },
  "code.goToLine": { run: goToLine, inText: true },
  "code.selectNextOccurrence": { run: selectNextOccurrence, inText: true },
};

/**
 * The editor keys CodeMirror's own keymaps do not cover. Listed before the default and
 * history keymaps, so Shift+Cmd+U is Toggle Case rather than Redo Selection.
 */
export const codeKeymap: readonly KeyBinding[] = (Object.keys(EDITOR_SHORTCUTS) as EditorAction[]).flatMap((action) => {
  const shortcut = EDITOR_SHORTCUTS[action];
  if (!shortcut || shortcut.source !== "code") {
    return [];
  }
  return [{ key: shortcut.key, mac: shortcut.mac, run: EDITOR_COMMANDS[action].run, preventDefault: true }];
});

export interface FocusedEditor {
  view: EditorView;
  /** The caret is in the text, not in the find bar or another panel. */
  inText: boolean;
}

/** The CodeMirror editor holding the keyboard focus, if any. */
export function focusedEditor(): FocusedEditor | null {
  const active = typeof document === "undefined" ? null : document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return null;
  }
  const root = active.closest<HTMLElement>(".cm-editor");
  const view = root ? EditorView.findFromDOM(root) : null;
  return view ? { view, inText: view.contentDOM.contains(active) } : null;
}

/** Runs a menu command in the focused editor; false when no editor can take it. */
export function runEditorCommand(action: EditorAction): boolean {
  const target = focusedEditor();
  const entry = EDITOR_COMMANDS[action];
  if (!target || (entry.inText && !target.inText)) {
    return false;
  }
  return entry.run(target.view);
}

/** Undo, Redo, Select All and Delete for the editor with the caret in its text. */
export function runTextEdit(view: EditorView, edit: "undo" | "redo" | "selectAll" | "delete"): boolean {
  switch (edit) {
    case "undo":
      return undo(view);
    case "redo":
      return redo(view);
    case "selectAll":
      return selectAll(view);
    case "delete":
      if (view.state.readOnly || view.state.selection.ranges.every((range) => range.empty)) {
        return false;
      }
      view.dispatch(view.state.replaceSelection(""), { userEvent: "delete.selection", scrollIntoView: true });
      return true;
  }
}
