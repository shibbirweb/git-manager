// The inline diff's look: removed lines soft red and added lines green (GitLens style), changed words, the number, sign and button columns.

import { EditorView } from "@codemirror/view";

export const inlineTheme = EditorView.theme({
  ".cm-content .cm-line.cm-inlineAdded": {
    backgroundColor: "var(--diff-added)",
  },
  ".cm-content .cm-line.cm-inlineRemoved": {
    backgroundColor: "var(--diff-removed)",
  },
  ".cm-content .cm-changedText": {
    borderRadius: "2px",
  },
  ".cm-content .cm-changedText-removed": {
    background: "var(--diff-removed-word)",
  },
  ".cm-content .cm-changedText-added": {
    background: "var(--diff-added-word)",
  },
  ".cm-lineNumbers.cm-inlineNumbers .cm-gutterElement": {
    padding: "0 6px 0 8px",
    minWidth: "28px",
  },
  ".cm-gutterElement.cm-inlineGutter-added": {
    backgroundColor: "var(--diff-added)",
  },
  ".cm-gutterElement.cm-inlineGutter-removed": {
    backgroundColor: "var(--diff-removed)",
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
