// Syntax highlighting for the native app, from the current app's own grammars (src/lib/editor/languages.ts) and
// highlighters (src/lib/editor/highlighter.ts), so both apps color code the same. scripts/build-app.sh bundles this
// file with Bun into the app's Resources/highlight.js; SyntaxHighlighter.swift (Sources/GitManagerNative/Services)
// runs it in JavaScriptCore. gmHighlight answers {"spans": [...], "brackets": [...]}, each a flat array of from, to,
// classes (UTF-16 offsets): the syntax spans, then the bracket pair colors of src/lib/editor/bracketColors.ts on top.

import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { highlightTree } from "@lezer/highlight";
import { bracketDecorations } from "../../src/lib/editor/bracketColors";
import { codeHighlighters } from "../../src/lib/editor/highlighter";
import { languageFor } from "../../src/lib/editor/languages";

/** The longest a parse may take, in milliseconds, before the rest stays plain. */
const PARSE_BUDGET_MS = 5000;

async function gmHighlight(filePath: string, text: string): Promise<string> {
  const language = await languageFor(filePath);
  const state = EditorState.create({ doc: text, extensions: [language] });
  const tree = ensureSyntaxTree(state, state.doc.length, PARSE_BUDGET_MS);
  const spans: (number | string)[] = [];
  const brackets: (number | string)[] = [];
  if (tree) {
    highlightTree(tree, codeHighlighters, (from, to, classes) => {
      spans.push(from, to, classes);
    });
    bracketDecorations(state, [{ from: 0, to: state.doc.length }]).between(0, state.doc.length, (from, to, value) => {
      brackets.push(from, to, String(value.spec.class ?? ""));
    });
  }
  return JSON.stringify({ spans, brackets });
}

(globalThis as Record<string, unknown>).gmHighlight = gmHighlight;
