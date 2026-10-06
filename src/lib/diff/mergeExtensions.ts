// CodeMirror extensions for the 2-way diff: app-token styling for
// @codemirror/merge and per-chunk line classes (added / deleted / modified).

import { getChunks } from "@codemirror/merge";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { icons, type IconName } from "$lib/ui/icons";

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
    borderRadius: "2px",
  },
  "&.cm-merge-a .cm-content .cm-diffDeleted .cm-changedText, &.cm-merge-b .cm-content .cm-diffAdded .cm-changedText": {
    background: "none",
  },
  "&.cm-merge-a .cm-gutters .cm-changedLineGutter, &.cm-merge-b .cm-gutters .cm-changedLineGutter": {
    background: "var(--diff-modified-edge)",
  },
  "&.cm-editor .cm-content .cm-diffFold": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "2px 8px",
    color: "var(--text-dim)",
    background: "var(--panel-alt)",
    borderTop: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    fontFamily: "var(--font-ui)",
    fontSize: "11.5px",
    cursor: "pointer",
  },
  "&.cm-editor .cm-content .cm-diffFoldLabel": {
    flex: "1",
    padding: "1px 4px",
  },
  "&.cm-editor .cm-content .cm-diffFold:hover .cm-diffFoldLabel": {
    color: "var(--text)",
  },
  "&.cm-editor .cm-content .cm-diffFoldStep": {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    padding: "1px 6px",
    border: "none",
    borderRadius: "4px",
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
  button.appendChild(iconSvg(iconName, 13));
  return button;
}
