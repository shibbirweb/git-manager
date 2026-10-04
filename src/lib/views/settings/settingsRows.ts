// Settings rows drawn from a list, shared by the Settings dialog and its search index.

/** Sublime Text's caret_extra_top and caret_extra_bottom. */
export const CARET_EXTRA_ROWS: { key: "editorCaretExtraTop" | "editorCaretExtraBottom"; label: string; hint: string }[] = [
  { key: "editorCaretExtraTop", label: "Caret extra top", hint: "Pixels the cursor reaches above the text, so it is easier to see." },
  { key: "editorCaretExtraBottom", label: "Caret extra bottom", hint: "Pixels the cursor reaches below the text." },
];

/** The IDE features of the editor (src/lib/editor/features.ts), each a switch. */
export const EDITOR_FEATURE_ROWS: {
  key:
    | "editorAutoCloseBrackets"
    | "editorCompletion"
    | "editorFoldGutter"
    | "editorIndentGuides"
    | "editorHighlightWord"
    | "editorScrollPastEnd"
    | "editorColumnSelection"
    | "editorStickyScroll"
    | "editorMinimap"
    | "editorBracketPairColors"
    | "editorMatchBrackets";
  label: string;
  hint: string;
}[] = [
  { key: "editorAutoCloseBrackets", label: "Auto-close brackets and quotes", hint: "Typing ( [ { or a quote adds the closing one." },
  {
    key: "editorCompletion",
    label: "Code completion",
    hint: "Suggest words from the file and the language's keywords. Ctrl+Space opens the list; Enter or Tab accepts.",
  },
  { key: "editorFoldGutter", label: "Fold arrows", hint: "Arrows beside the line numbers fold and unfold blocks in the file editor." },
  { key: "editorIndentGuides", label: "Indent guides", hint: "Faint lines at each indent level, also in diffs and the merge tool." },
  { key: "editorHighlightWord", label: "Highlight the word at the cursor", hint: "Mark the other uses of that word." },
  { key: "editorScrollPastEnd", label: "Scroll past the end", hint: "Scroll the last line up to the top of the file editor." },
  { key: "editorColumnSelection", label: "Column selection", hint: "Option+drag selects a rectangle of text." },
  { key: "editorStickyScroll", label: "Sticky scroll", hint: "Keep the lines of the blocks you are in pinned at the top of the file editor. Click one to jump to it." },
  { key: "editorMinimap", label: "Minimap", hint: "A small picture of the whole file beside the scrollbar of the file editor." },
  { key: "editorBracketPairColors", label: "Bracket pair colors", hint: "Color brackets by how deep they are nested, also in diffs and the merge tool." },
  { key: "editorMatchBrackets", label: "Highlight matching brackets", hint: "Mark the bracket that pairs with the one at the cursor." },
];

export const SAVE_CLEANUP_ROWS: { key: "trimTrailingWhitespace" | "insertFinalNewline" | "trimFinalNewlines"; label: string; hint: string }[] = [
  {
    key: "trimTrailingWhitespace",
    label: "Trim trailing whitespace",
    hint: "Remove spaces and tabs at the end of lines. Markdown keeps two spaces at a line end, since they make a line break there.",
  },
  { key: "insertFinalNewline", label: "Insert final newline", hint: "End the file with a newline when it has none." },
  { key: "trimFinalNewlines", label: "Trim final newlines", hint: "Remove blank lines after the last line of text." },
];
