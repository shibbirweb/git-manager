// Syntax highlighting for the native app, from the current app's own grammars (src/lib/editor/languages.ts) and
// highlighters (src/lib/editor/highlighter.ts), so both apps color code the same. scripts/build-app.sh bundles this
// file with Bun into the app's Resources/highlight.js; SyntaxHighlighter.swift (Sources/GitManagerNative/Services)
// runs it in JavaScriptCore. gmHighlight answers {"spans": [...], "brackets": [...], "folds": [...]}: flat arrays of
// from, to, classes (UTF-16 offsets) for the syntax spans and the bracket pair colors of
// src/lib/editor/bracketColors.ts, then from, to of what each line can fold (foldable, as the fold gutter asks).
// With `upTo` only the text before that offset is parsed and colored, as CodeMirror parses up to the viewport
// first; `folds` false skips the folds (a diff has no fold gutter).

import { ensureSyntaxTree, foldable } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { highlightTree } from "@lezer/highlight";
import { bracketDecorations } from "../../src/lib/editor/bracketColors";
import { codeHighlighters } from "../../src/lib/editor/highlighter";
import { languageFor } from "../../src/lib/editor/languages";

/** The longest a parse may take, in milliseconds, before the rest stays plain. */
const PARSE_BUDGET_MS = 5000;

interface HighlightOptions {
  upTo?: number;
  folds?: boolean;
}

async function gmHighlight(filePath: string, text: string, options: HighlightOptions = {}): Promise<string> {
  const language = await languageFor(filePath);
  const state = EditorState.create({ doc: text, extensions: [language] });
  const end = Math.min(state.doc.length, options.upTo ?? state.doc.length);
  const tree = ensureSyntaxTree(state, end, PARSE_BUDGET_MS);
  const spans: (number | string)[] = [];
  const brackets: (number | string)[] = [];
  const folds: number[] = [];
  if (tree) {
    highlightTree(
      tree,
      codeHighlighters,
      (from, to, classes) => {
        spans.push(from, to, classes);
      },
      0,
      end,
    );
    bracketDecorations(state, [{ from: 0, to: end }]).between(0, end, (from, to, value) => {
      brackets.push(from, to, String(value.spec.class ?? ""));
    });
    const foldLines = options.folds === false ? 0 : state.doc.lines;
    for (let number = 1; number <= foldLines; number++) {
      const line = state.doc.line(number);
      const range = foldable(state, line.from, line.to);
      if (range) {
        folds.push(range.from, range.to);
      }
    }
  }
  return JSON.stringify({ spans, brackets, folds });
}

(globalThis as Record<string, unknown>).gmHighlight = gmHighlight;
