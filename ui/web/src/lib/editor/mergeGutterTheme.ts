// The look of merge gutters (mergeGutters.ts): chunk rows in their change's color with its edges, and the buttons.
import { EditorView } from "@codemirror/view";

/** The colors of chunk rows in the gutters and the look of the chunk buttons. */
export const mergeGutterTheme = EditorView.theme({
  ".cm-gutterElement.cm-mc-gutter.cm-mc-modified": {
    backgroundColor: "var(--diff-modified)",
    "--mc-edge": "var(--diff-modified-edge)",
  },
  ".cm-gutterElement.cm-mc-gutter.cm-mc-added": {
    backgroundColor: "var(--diff-added)",
    "--mc-edge": "var(--diff-added-edge)",
  },
  ".cm-gutterElement.cm-mc-gutter.cm-mc-deleted": {
    backgroundColor: "var(--diff-deleted)",
    "--mc-edge": "var(--diff-deleted-edge)",
  },
  ".cm-gutterElement.cm-mc-gutter.cm-mc-conflict": {
    backgroundColor: "var(--diff-conflict)",
    "--mc-edge": "var(--diff-conflict-edge)",
  },
  ".cm-gutterElement.cm-mc-first": { boxShadow: "inset 0 1px 0 var(--mc-edge)" },
  ".cm-gutterElement.cm-mc-last": { boxShadow: "inset 0 -1px 0 var(--mc-edge)" },
  ".cm-gutterElement.cm-mc-single": { boxShadow: "inset 0 1px 0 var(--mc-edge), inset 0 -1px 0 var(--mc-edge)" },
  ".cm-gutterElement.cm-mc-edge-modified": { "--mc-edge": "var(--diff-modified-edge)" },
  ".cm-gutterElement.cm-mc-edge-added": { "--mc-edge": "var(--diff-added-edge)" },
  ".cm-gutterElement.cm-mc-edge-deleted": { "--mc-edge": "var(--diff-deleted-edge)" },
  ".cm-gutterElement.cm-mc-edge-conflict": { "--mc-edge": "var(--diff-conflict-edge)" },
  ".cm-gutterElement.cm-mc-gap-before": { boxShadow: "inset 0 var(--merge-view-gap-edge) 0 var(--mc-edge)" },
  ".cm-gutterElement.cm-mc-gap-after": {
    boxShadow: "inset 0 calc(-1 * var(--merge-view-gap-edge)) 0 var(--mc-edge)",
  },
  ".cm-mc-actions .cm-gutterElement": {
    minWidth: "var(--merge-view-actions-width)",
    padding: "0 var(--merge-view-actions-padding-x)",
  },
  ".cm-mc-buttons": {
    display: "flex",
    alignItems: "center",
    gap: "var(--merge-view-actions-gap)",
    height: "100%",
  },
  ".cm-mc-btn": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "var(--merge-view-action-size)",
    height: "var(--merge-view-action-size)",
    padding: "0",
    border: "none",
    borderRadius: "var(--radius-small)",
    background: "transparent",
    color: "var(--text-dim)",
    cursor: "pointer",
  },
  ".cm-mc-btn svg": { width: "var(--merge-view-action-icon)", height: "var(--merge-view-action-icon)" },
  ".cm-mc-btn:hover": { background: "var(--hover)", color: "var(--text)" },
  ".cm-mc-btn-apply.cm-mc-modified": { color: "var(--diff-modified-edge)" },
  ".cm-mc-btn-apply.cm-mc-added": { color: "var(--diff-added-edge)" },
  ".cm-mc-btn-apply.cm-mc-deleted": { color: "var(--diff-deleted-edge)" },
  ".cm-mc-btn-apply.cm-mc-conflict": { color: "var(--diff-conflict-edge)" },
  ".cm-mc-btn-ignore:hover, .cm-mc-btn-revert:hover": { color: "var(--danger)" },
});
