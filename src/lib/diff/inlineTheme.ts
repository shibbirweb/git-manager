// The inline diff's look: line colors by kind of change, changed words, the number, sign and button columns.

import { EditorView } from "@codemirror/view";

export const inlineTheme = EditorView.theme({
  ".cm-content .cm-line.cm-inlineAdded": {
    backgroundColor: "var(--diff-added)",
  },
  ".cm-content .cm-line.cm-inlineDeleted": {
    backgroundColor: "var(--diff-deleted)",
  },
  ".cm-content .cm-line.cm-inlineModified": {
    backgroundColor: "var(--diff-modified)",
  },
  ".cm-content .cm-changedText": {
    background: "var(--diff-inline)",
    borderRadius: "2px",
  },
  ".cm-lineNumbers.cm-inlineNumbers .cm-gutterElement": {
    padding: "0 6px 0 8px",
    minWidth: "28px",
  },
  ".cm-gutterElement.cm-inlineGutter-added": {
    backgroundColor: "var(--diff-added)",
  },
  ".cm-gutterElement.cm-inlineGutter-deleted": {
    backgroundColor: "var(--diff-deleted)",
  },
  ".cm-gutterElement.cm-inlineGutter-modified": {
    backgroundColor: "var(--diff-modified)",
  },
  ".cm-inlineSigns .cm-gutterElement": {
    padding: "0 4px",
    fontFamily: "var(--font-mono)",
    fontWeight: "600",
    textAlign: "center",
  },
  ".cm-gutterElement.cm-inlineSign-added": {
    color: "var(--success)",
  },
  ".cm-gutterElement.cm-inlineSign-removed": {
    color: "var(--danger)",
  },
  ".cm-inlineControls .cm-gutterElement": {
    display: "flex",
    alignItems: "center",
    padding: "0 2px",
  },
  ".cm-inlineControls .diff-controls": {
    display: "inline-flex",
    gap: "2px",
  },
  ".cm-inlineControls .diff-revert, .cm-inlineControls .diff-revert-spacer": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "16px",
  },
  ".cm-inlineControls .diff-revert": {
    padding: "0",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    color: "var(--accent)",
    cursor: "pointer",
  },
  ".cm-inlineControls .diff-revert:hover": {
    background: "var(--hover)",
    color: "var(--accent-hover)",
  },
  ".cm-inlineControls .diff-revert.diff-revert-change": {
    color: "var(--text-dim)",
  },
  ".cm-inlineControls .diff-revert.diff-revert-change:hover": {
    color: "var(--danger)",
  },
  ".cm-inlineControls .diff-revert svg": {
    pointerEvents: "none",
  },
});
