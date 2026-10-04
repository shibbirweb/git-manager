// Shared CodeMirror configuration. Languages are loaded on demand so only the
// grammars actually used end up in memory.

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { settings } from "$lib/stores/settings.svelte";
import { commandKeys } from "./commandKeys";
import { codeKeymap } from "./editorCommands";
import { findBar } from "./findPanel.svelte";
import { highlightActiveLineWhenEmpty } from "./activeLine";
import { cursorOptions, editorCursor } from "./cursor";
import { type EditorKind, featureOptions } from "./featurePlan";
import { editorFeatures } from "./features";
import { indentation } from "./indentation";
import { renderWhitespace } from "./whitespace";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--code-size)",
    backgroundColor: "var(--editor-bg)",
    color: "var(--text)",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    fontWeight: "var(--code-weight, 400)",
    lineHeight: "var(--code-line-height, 1.25)",
  },
  ".cm-content": {
    caretColor: "var(--editor-cursor)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--editor-cursor)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter)",
    color: "var(--editor-line-number)",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 12px",
    minWidth: "40px",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active-line)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active-line)",
    color: "var(--text-dim)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, var(--warning) 30%, transparent)",
    outline: "none",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, var(--warning) 62%, transparent)",
    outline: "1px solid color-mix(in srgb, var(--warning) 85%, transparent)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in srgb, var(--accent) 18%, transparent)",
  },
  ".cm-panels": {
    backgroundColor: "var(--panel)",
    color: "var(--text)",
    borderColor: "var(--border-strong)",
  },
  ".cm-panels input, .cm-panels button": {
    fontFamily: "var(--font-ui)",
  },
  // The find bar draws its own bottom border.
  ".cm-panels.cm-panels-top": {
    borderBottom: "none",
  },
});

export interface EditorOptions {
  readOnly?: boolean;
  /** Which IDE features apply (features.ts); editable panes default to the file editor, read-only ones to a diff side. */
  kind?: EditorKind;
  /** Extra extensions appended after the defaults. */
  extensions?: Extension[];
}

export function baseExtensions({ readOnly = false, kind, extensions = [] }: EditorOptions = {}): Extension[] {
  const common: Extension[] = [
    lineNumbers(),
    highlightSpecialChars(),
    drawSelection(),
    syntaxHighlighting(classHighlighter),
    // Auto-close, completion, folding, guides, word highlight, margin line, sticky scroll,
    // minimap, bracket colors and matching... each switchable in Settings.
    editorFeatures(kind ?? (readOnly ? "diff" : "file"), featureOptions(settings)),
    // Select All Occurrences and Cmd+D add carets; Option+Shift+click adds one (JetBrains).
    EditorState.allowMultipleSelections.of(true),
    EditorView.clickAddsSelectionRange.of((event) => event.altKey && event.shiftKey),
    findBar(),
    renderWhitespace(settings.renderWhitespace),
    editorCursor(cursorOptions(settings)),
    editorTheme,
    // The file's own indentation, or the Tab size setting; open editors follow both settings.
    indentation({ detect: settings.detectIndentation, tabSize: settings.tabSize }),
    // Custom keys from Settings > Keyboard Shortcuts, ahead of every default key.
    commandKeys(),
    // The Code menu's keys (Duplicate, Join Lines, Toggle Case...), ahead of the defaults.
    keymap.of(codeKeymap),
    keymap.of(defaultKeymap),
  ];
  if (readOnly) {
    return [...common, EditorState.readOnly.of(true), ...extensions];
  }
  return [
    ...common,
    history(),
    indentOnInput(),
    highlightActiveLineWhenEmpty(),
    highlightActiveLineGutter(),
    keymap.of([...historyKeymap, indentWithTab]),
    ...extensions,
  ];
}

// Languages live in languages.ts; re-exported so the editors keep one import.
export { grammarFor, languageFor, languageName } from "./languages";
