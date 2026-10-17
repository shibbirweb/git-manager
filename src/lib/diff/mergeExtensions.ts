// CodeMirror extensions for the 2-way diff: app-token styling for
// @codemirror/merge and per-chunk line classes (added / deleted / modified), and the two-pane red and green.

import { getChunks } from "@codemirror/merge";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { icons, type IconName } from "@nibtree/ui/icons";
import { scales } from "@nibtree/ui/tokens";

const addedLine = Decoration.line({ class: "cm-diffAdded" });
const deletedLine = Decoration.line({ class: "cm-diffDeleted" });

/** Marks lines of pure insertions (b side) and pure deletions (a side). */
function buildKindDecorations(view: EditorView): DecorationSet {
  const info = getChunks(view.state);
  if (!info || !info.side) {
    return Decoration.none;
  }
  const isA = info.side === "a";
  const doc = view.state.doc;
  const { from: viewFrom, to: viewTo } = view.viewport;
  const builder = new RangeSetBuilder<Decoration>();
  for (const chunk of info.chunks) {
    const from = isA ? chunk.fromA : chunk.fromB;
    const to = isA ? chunk.toA : chunk.toB;
    const otherEmpty = isA ? chunk.fromB === chunk.toB : chunk.fromA === chunk.toA;
    if (from >= viewTo) {
      break;
    }
    if (from === to || !otherEmpty || to <= viewFrom) {
      continue;
    }
    const decoration = isA ? deletedLine : addedLine;
    let pos = from;
    while (pos < to && pos <= doc.length) {
      const line = doc.lineAt(pos);
      builder.add(line.from, line.from, decoration);
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export const chunkKinds = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildKindDecorations(view);
    }

    update(update: ViewUpdate): void {
      const chunksChanged = getChunks(update.startState)?.chunks !== getChunks(update.state)?.chunks;
      if (update.docChanged || update.viewportChanged || chunksChanged) {
        this.decorations = buildKindDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/** One period of a fold's wavy line, used as a mask so the line takes a theme color. */
const WAVE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="6"><path d="M0 3 Q3 0 6 3 T12 3" fill="none" stroke="#000" stroke-width="1.2"/></svg>';

export const diffTheme = EditorView.theme({
  "&.cm-merge-a .cm-content .cm-line.cm-changedLine, &.cm-merge-b .cm-content .cm-line.cm-changedLine": {
    backgroundColor: "var(--diff-modified)",
  },
  "&.cm-merge-b .cm-content .cm-line.cm-changedLine.cm-diffAdded": {
    backgroundColor: "var(--diff-added)",
  },
  "&.cm-merge-a .cm-content .cm-line.cm-changedLine.cm-diffDeleted": {
    backgroundColor: "var(--diff-deleted)",
  },
  "&.cm-merge-a .cm-content .cm-line .cm-changedText, &.cm-merge-b .cm-content .cm-line .cm-changedText": {
    background: "var(--diff-inline)",
    borderRadius: "var(--inline-diff-change-radius)",
  },
  "&.cm-merge-a .cm-content .cm-diffDeleted .cm-changedText, &.cm-merge-b .cm-content .cm-diffAdded .cm-changedText": {
    background: "none",
  },
  "&.cm-merge-a .cm-gutters .cm-changedLineGutter, &.cm-merge-b .cm-gutters .cm-changedLineGutter": {
    background: "var(--diff-modified-edge)",
  },
  // A fold: the code's scope in small dim text over a wavy line, no box.
  "&.cm-editor .cm-content .cm-diffFold": {
    display: "flex",
    alignItems: "center",
    gap: "var(--diff-fold-gap)",
    padding:
      "var(--diff-fold-padding-y) var(--diff-fold-padding-right) var(--diff-fold-padding-y) " +
      "var(--diff-fold-padding-left)",
    color: "var(--text-dim)",
    fontFamily: "var(--font-ui)",
    fontSize: "var(--diff-fold-font-size)",
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  "&.cm-editor .cm-content .cm-diffFoldLabel": {
    flex: "0 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    padding: "var(--diff-fold-label-padding-y) var(--diff-fold-label-padding-x)",
    border: "1px solid var(--border)",
    borderRadius: "var(--diff-fold-label-radius)",
    background: "var(--editor-bg)",
  },
  "&.cm-editor .cm-content .cm-diffFoldWave": {
    flex: "1",
    minWidth: "var(--diff-fold-wave-min-width)",
    height: "var(--diff-fold-wave-height)",
    background: "var(--border-strong)",
    mask:
      `url("data:image/svg+xml,${encodeURIComponent(WAVE)}") repeat-x left center / ` +
      "var(--diff-fold-wave-tile) var(--diff-fold-wave-height)",
  },
  "&.cm-editor .cm-content .cm-diffFold:hover .cm-diffFoldLabel": {
    color: "var(--text)",
    borderColor: "var(--border-strong)",
  },
  "&.cm-editor .cm-content .cm-diffFold:hover .cm-diffFoldWave": {
    background: "var(--accent)",
  },
  "&.cm-editor .cm-content .cm-diffFoldStep": {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--diff-fold-step-gap)",
    padding: "var(--diff-fold-step-padding-y) var(--diff-fold-step-padding-x)",
    border: "none",
    borderRadius: "var(--diff-fold-step-radius)",
    background: "transparent",
    color: "var(--accent)",
    font: "inherit",
    cursor: "pointer",
  },
  "&.cm-editor .cm-content .cm-diffFoldStep:hover": {
    background: "var(--hover)",
    color: "var(--accent-hover)",
  },
  "&.cm-editor .cm-content .cm-diffFoldStep svg": {
    pointerEvents: "none",
  },
});

const SVG_NS = "http://www.w3.org/2000/svg";

/** An icon as an SVG element, for DOM built outside Svelte (CodeMirror widgets and gutters). */
export function iconSvg(iconName: IconName, size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.4");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of icons[iconName]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

/** Builds a small icon button for the merge view's revert column. */
export function revertButton(title: string, iconName: IconName): HTMLElement {
  const button = document.createElement("button");
  button.className = "diff-revert";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.appendChild(iconSvg(iconName, scales.iconSize.medium));
  return button;
}

/**
 * The two-pane diff's colors: changed lines red on the old side and green on the new,
 * with stronger tints on the changed words. The three-pane views keep the kind colors of `diffTheme`.
 */
export const sideColors = [
  EditorView.editorAttributes.of({ class: "cm-sideColors" }),
  EditorView.theme({
    "&.cm-sideColors.cm-merge-a .cm-content .cm-line.cm-changedLine": {
      backgroundColor: "var(--diff-removed)",
    },
    "&.cm-sideColors.cm-merge-b .cm-content .cm-line.cm-changedLine": {
      backgroundColor: "var(--diff-added)",
    },
    "&.cm-sideColors.cm-merge-a .cm-content .cm-line .cm-changedText": {
      background: "var(--diff-removed-word)",
    },
    "&.cm-sideColors.cm-merge-b .cm-content .cm-line .cm-changedText": {
      background: "var(--diff-added-word)",
    },
    // A whole removed or added line already has its color; only modified lines mark their words.
    "&.cm-sideColors.cm-merge-a .cm-content .cm-diffDeleted .cm-changedText": {
      background: "none",
    },
    "&.cm-sideColors.cm-merge-b .cm-content .cm-diffAdded .cm-changedText": {
      background: "none",
    },
    // Number rows take their side's color with no edge lines, like the text; a removed or added gap keeps its edge.
    "&.cm-sideColors .cm-gutterElement.cm-mc-old": { "--mc-edge": "var(--danger)" },
    "&.cm-sideColors .cm-gutterElement.cm-mc-new": { "--mc-edge": "var(--diff-added-edge)" },
    "&.cm-sideColors .cm-gutterElement.cm-mc-gutter.cm-mc-old": {
      backgroundColor: "var(--diff-removed)",
      "--mc-edge": "transparent",
    },
    "&.cm-sideColors .cm-gutterElement.cm-mc-gutter.cm-mc-new": {
      backgroundColor: "var(--diff-added)",
      "--mc-edge": "transparent",
    },
    "&.cm-sideColors.cm-merge-a .cm-gutters .cm-changedLineGutter": {
      background: "var(--danger)",
    },
    "&.cm-sideColors.cm-merge-b .cm-gutters .cm-changedLineGutter": {
      background: "var(--diff-added-edge)",
    },
  }),
];

/**
 * The three-pane diff's colors, like `sideColors`: a change is red where it is older and green where it is newer
 * (the marks' tone from threeWay.ts). A merge commit's conflicts keep their color.
 */
export const toneColors = [
  EditorView.editorAttributes.of({ class: "cm-toneColors" }),
  EditorView.theme({
    // .cm-line makes these win over the kind edges (.cm-mc-line.cm-mc-modified, .cm-mc-edge-modified).
    "&.cm-toneColors .cm-line.cm-mc-old": { "--mc-edge": "var(--danger)" },
    "&.cm-toneColors .cm-line.cm-mc-new": { "--mc-edge": "var(--diff-added-edge)" },
    "&.cm-toneColors .cm-mc-line.cm-mc-old": { backgroundColor: "var(--diff-removed)" },
    "&.cm-toneColors .cm-mc-line.cm-mc-new": { backgroundColor: "var(--diff-added)" },
    "&.cm-toneColors .cm-gutterElement.cm-mc-gutter.cm-mc-old": {
      backgroundColor: "var(--diff-removed)",
      "--mc-edge": "var(--danger)",
    },
    "&.cm-toneColors .cm-gutterElement.cm-mc-gutter.cm-mc-new": {
      backgroundColor: "var(--diff-added)",
      "--mc-edge": "var(--diff-added-edge)",
    },
    "&.cm-toneColors .cm-mc-inline-old": { backgroundColor: "var(--diff-removed-word)" },
    "&.cm-toneColors .cm-mc-inline-new": { backgroundColor: "var(--diff-added-word)" },
  }),
];
