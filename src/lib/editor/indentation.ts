// Indentation of every editor: what the file already uses when Settings > Editor > Detect
// indentation is on (VS Code's editor.detectIndentation), else the Tab size setting. Read from
// the text when an editor opens, and again in every open editor when either setting changes.

import { indentUnit } from "@codemirror/language";
import { EditorState, type Extension, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { detectIndentation, MAX_DETECT_LINES } from "./indentDetect";

export interface IndentOptions {
  detect: boolean;
  tabSize: number;
}

export interface EditorIndent {
  useTabs: boolean;
  /** Spaces per level, or the width of a tab. */
  size: number;
  /** Taken from the file rather than the Tab size setting. */
  detected: boolean;
}

let options: IndentOptions = { detect: true, tabSize: 4 };
const views = new Set<EditorView>();
const redetect = StateEffect.define<IndentOptions>();

function indentFor(state: EditorState, next: IndentOptions): EditorIndent {
  const found = next.detect ? detectIndentation(state.doc.iterLines(1, Math.min(state.doc.lines, MAX_DETECT_LINES) + 1)) : null;
  if (!found) {
    return { useTabs: false, size: next.tabSize, detected: false };
  }
  return { useTabs: found.useTabs, size: found.size ?? next.tabSize, detected: true };
}

const indentField = StateField.define<EditorIndent>({
  create: (state) => indentFor(state, options),
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(redetect)) {
        return indentFor(transaction.state, effect.value);
      }
    }
    return value;
  },
});

const registry = ViewPlugin.define((view) => {
  views.add(view);
  return {
    destroy() {
      views.delete(view);
    },
  };
});

/** Indentation for a new editor, detected from its text with the current settings. */
export function indentation(next: IndentOptions): Extension {
  options = next;
  return [
    registry,
    indentField,
    EditorState.tabSize.compute([indentField], (state) => state.field(indentField).size),
    indentUnit.compute([indentField], (state) => {
      const indent = state.field(indentField);
      return indent.useTabs ? "\t" : " ".repeat(indent.size);
    }),
  ];
}

/** What an editor indents with, for the status bar. */
export function editorIndent(state: EditorState): EditorIndent {
  return state.field(indentField, false) ?? { useTabs: false, size: state.tabSize, detected: false };
}

/** Applies changed settings to every open editor: each reads its text again. */
export function setIndentation(next: IndentOptions): void {
  if (next.detect === options.detect && next.tabSize === options.tabSize) {
    return;
  }
  options = next;
  const effects = redetect.of(next);
  for (const view of views) {
    view.dispatch({ effects });
  }
}
