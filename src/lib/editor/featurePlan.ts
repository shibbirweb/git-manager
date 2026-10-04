// Which IDE features each kind of editor gets, and which change between two sets of
// settings. Kept free of CodeMirror so it can be tested directly; features.ts applies it.

import type { Preferences } from "$lib/stores/settingsData";

/** The file editor, a diff side, or a merge tool pane (Yours, Result, Theirs). */
export type EditorKind = "file" | "diff" | "merge";

export const EDITOR_FEATURES = [
  "autoCloseBrackets",
  "completion",
  "foldGutter",
  "indentGuides",
  "highlightWord",
  "scrollPastEnd",
  "columnSelection",
  "ruler",
  "stickyScroll",
  "minimap",
  "bracketPairColors",
  "matchBrackets",
] as const;

export type EditorFeature = (typeof EDITOR_FEATURES)[number];

export interface EditorFeatureOptions {
  autoCloseBrackets: boolean;
  completion: boolean;
  completionOnTyping: boolean;
  foldGutter: boolean;
  indentGuides: boolean;
  highlightWord: boolean;
  scrollPastEnd: boolean;
  columnSelection: boolean;
  /** 0 hides the margin line. */
  rulerColumn: number;
  stickyScroll: boolean;
  minimap: boolean;
  bracketPairColors: boolean;
  matchBrackets: boolean;
}

/**
 * Where each feature applies. Typing aids only help where you type code. Folding and
 * scrolling past the end would move one pane's lines against the others in a diff or the
 * merge tool, so they stay in the file editor; drawing and selecting work everywhere. The
 * sides of a diff share one scroller, so sticky scroll and the minimap are file editor only.
 */
export const FEATURE_KINDS: Record<EditorFeature, readonly EditorKind[]> = {
  autoCloseBrackets: ["file"],
  completion: ["file"],
  foldGutter: ["file"],
  indentGuides: ["file", "diff", "merge"],
  highlightWord: ["file", "diff", "merge"],
  scrollPastEnd: ["file"],
  columnSelection: ["file", "diff", "merge"],
  ruler: ["file", "diff", "merge"],
  stickyScroll: ["file"],
  minimap: ["file"],
  bracketPairColors: ["file", "diff", "merge"],
  matchBrackets: ["file", "diff", "merge"],
};

/** The settings that switch the features. */
export type EditorFeaturePreferences = Pick<
  Preferences,
  | "editorAutoCloseBrackets"
  | "editorCompletion"
  | "editorCompletionOnTyping"
  | "editorFoldGutter"
  | "editorIndentGuides"
  | "editorHighlightWord"
  | "editorScrollPastEnd"
  | "editorColumnSelection"
  | "editorRulerColumn"
  | "editorStickyScroll"
  | "editorMinimap"
  | "editorBracketPairColors"
  | "editorMatchBrackets"
>;

export function featureOptions(preferences: EditorFeaturePreferences): EditorFeatureOptions {
  return {
    autoCloseBrackets: preferences.editorAutoCloseBrackets,
    completion: preferences.editorCompletion,
    completionOnTyping: preferences.editorCompletionOnTyping,
    foldGutter: preferences.editorFoldGutter,
    indentGuides: preferences.editorIndentGuides,
    highlightWord: preferences.editorHighlightWord,
    scrollPastEnd: preferences.editorScrollPastEnd,
    columnSelection: preferences.editorColumnSelection,
    rulerColumn: preferences.editorRulerColumn,
    stickyScroll: preferences.editorStickyScroll,
    minimap: preferences.editorMinimap,
    bracketPairColors: preferences.editorBracketPairColors,
    matchBrackets: preferences.editorMatchBrackets,
  };
}

function featureOn(feature: EditorFeature, options: EditorFeatureOptions): boolean {
  return feature === "ruler" ? options.rulerColumn > 0 : options[feature];
}

/** The feature is switched on and belongs in this kind of editor. */
export function featureApplies(feature: EditorFeature, kind: EditorKind, options: EditorFeatureOptions): boolean {
  return FEATURE_KINDS[feature].includes(kind) && featureOn(feature, options);
}

/** Features whose extension differs between two sets of options, so only those are rebuilt. */
export function changedFeatures(previous: EditorFeatureOptions, next: EditorFeatureOptions): EditorFeature[] {
  return EDITOR_FEATURES.filter((feature) => {
    switch (feature) {
      case "completion":
        return previous.completion !== next.completion || (next.completion && previous.completionOnTyping !== next.completionOnTyping);
      case "ruler":
        return previous.rulerColumn !== next.rulerColumn;
      default:
        return previous[feature] !== next[feature];
    }
  });
}

/** Prose and plain text get words only on Ctrl+Space, like JetBrains, so writing a sentence opens no list. */
export function wordsWhileTyping(languageName: string | null): boolean {
  return languageName !== null && languageName !== "markdown";
}

/** The autocomplete package is needed by these features; it loads the first time one is used. */
export function needsAutocomplete(feature: EditorFeature): boolean {
  return feature === "autoCloseBrackets" || feature === "completion";
}
