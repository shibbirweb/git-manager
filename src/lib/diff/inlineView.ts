// CodeMirror glue for the inline diff (the document and its logic live in inlineDoc.ts): line
// colors by kind of change, changed words, the old and new number columns, a Stage or Unstage
// button per change, and folded runs of unchanged lines.

import { type EditorState, type Extension, type Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, GutterMarker, gutter, WidgetType } from "@codemirror/view";
import { collapsedRuns, type InlineBlock, type InlineDoc, inlineWordMarks } from "./inlineDoc";
import { revertButton } from "./mergeExtensions";

export interface InlineViewOptions {
  doc: InlineDoc;
  collapse: boolean;
  /** The button on each change: Stage (unstaged diff), Unstage (staged diff), or none. */
  control: "stage" | "unstage" | null;
  onControl: (block: InlineBlock) => void;
}

type BlockKind = "added" | "deleted" | "modified";

function blockKind(block: InlineBlock): BlockKind {
  if (block.split === block.from) {
    return "added";
  }
  return block.split === block.to ? "deleted" : "modified";
}

/** The kind of change per document line, null for unchanged lines. */
function lineKinds(doc: InlineDoc): (BlockKind | null)[] {
  const kinds: (BlockKind | null)[] = new Array<BlockKind | null>(doc.lines.length).fill(null);
  for (const block of doc.blocks) {
    const kind = blockKind(block);
    for (let line = block.from; line < block.to; line++) {
      kinds[line] = kind;
    }
  }
  return kinds;
}

const lineClass: Record<BlockKind, Decoration> = {
  added: Decoration.line({ class: "cm-inlineAdded" }),
  deleted: Decoration.line({ class: "cm-inlineDeleted" }),
  modified: Decoration.line({ class: "cm-inlineModified" }),
};
const changedWord = Decoration.mark({ class: "cm-changedText" });

function changeDecorations(state: EditorState, doc: InlineDoc, kinds: readonly (BlockKind | null)[]): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  kinds.forEach((kind, index) => {
    if (kind && index < state.doc.lines) {
      ranges.push(lineClass[kind].range(state.doc.line(index + 1).from));
    }
  });
  for (const mark of inlineWordMarks(doc)) {
    if (mark.to <= state.doc.length) {
      ranges.push(changedWord.range(mark.from, mark.to));
    }
  }
  return Decoration.set(ranges, true);
}

class NumberMarker extends GutterMarker {
  constructor(
    readonly text: string,
    readonly kind: BlockKind | null,
  ) {
    super();
    this.elementClass = kind ? `cm-inlineGutter-${kind}` : "";
  }

  eq(other: NumberMarker): boolean {
    return other.text === this.text && other.kind === this.kind;
  }

  toDOM(): Node {
    return document.createTextNode(this.text);
  }
}

function numberGutter(side: "old" | "new", doc: InlineDoc, kinds: readonly (BlockKind | null)[]): Extension {
  let largest = 1;
  for (const line of doc.lines) {
    largest = Math.max(largest, (side === "old" ? (line.old ?? 0) : (line.new ?? 0)) + 1);
  }
  const widest = String(largest);
  return gutter({
    class: `cm-lineNumbers cm-inlineNumbers cm-inlineNumbers-${side}`,
    lineMarker: (view, line) => {
      const index = view.state.doc.lineAt(line.from).number - 1;
      const info = doc.lines[index];
      const number = side === "old" ? info?.old : info?.new;
      return new NumberMarker(number === null || number === undefined ? "" : String(number + 1), kinds[index] ?? null);
    },
    lineMarkerChange: () => false,
    initialSpacer: () => new NumberMarker(widest, null),
  });
}

class ControlMarker extends GutterMarker {
  constructor(
    readonly block: InlineBlock,
    readonly control: "stage" | "unstage",
    readonly run: (block: InlineBlock) => void,
  ) {
    super();
  }

  eq(other: ControlMarker): boolean {
    return other.block === this.block && other.control === this.control;
  }

  toDOM(): Node {
    const button = this.control === "stage" ? revertButton("Stage this change", "plus") : revertButton("Unstage this change", "minus");
    // Mousedown, like the side by side buttons, so the click never moves the cursor first.
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.run(this.block);
    });
    return button;
  }
}

class SpacerMarker extends GutterMarker {
  toDOM(): Node {
    const spacer = document.createElement("span");
    spacer.className = "diff-revert-spacer";
    return spacer;
  }
}

function controlGutter(doc: InlineDoc, control: "stage" | "unstage", run: (block: InlineBlock) => void): Extension {
  const byLine = new Map(doc.blocks.map((block) => [block.from, new ControlMarker(block, control, run)]));
  return gutter({
    class: "cm-inlineControls",
    lineMarker: (view, line) => byLine.get(view.state.doc.lineAt(line.from).number - 1) ?? null,
    lineMarkerChange: () => false,
    initialSpacer: () => new SpacerMarker(),
  });
}

/** Opens a folded run: the effect carries the run's start position. */
const expandRun = StateEffect.define<number>();

class CollapsedWidget extends WidgetType {
  constructor(readonly count: number) {
    super();
  }

  eq(other: CollapsedWidget): boolean {
    return other.count === this.count;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement("div");
    element.className = "cm-collapsedLines";
    element.textContent = `${this.count} unchanged lines`;
    element.addEventListener("click", () => {
      view.dispatch({ effects: expandRun.of(view.posAtDOM(element)) });
    });
    return element;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * Folded runs as block widgets (a StateField, since block decorations cannot come from a
 * plugin). A run opens when clicked, or when the cursor lands in it, so a Find match or a
 * reveal inside a folded run is never hidden.
 */
function collapsedField(runs: readonly [number, number][]): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: (state) =>
      Decoration.set(
        runs
          .filter(([, to]) => to <= state.doc.lines)
          .map(([from, to]) =>
            Decoration.replace({ widget: new CollapsedWidget(to - from), block: true }).range(
              state.doc.line(from + 1).from,
              state.doc.line(to).to,
            ),
          ),
      ),
    update(value, tr) {
      let next = value;
      for (const effect of tr.effects) {
        if (effect.is(expandRun)) {
          next = next.update({ filter: (from) => from !== effect.value });
        }
      }
      if (tr.selection) {
        const head = tr.selection.main.head;
        next = next.update({ filter: (from, to) => head < from || head > to });
      }
      return next;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

const inlineTheme = EditorView.theme({
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
  ".cm-inlineControls .cm-gutterElement": {
    display: "flex",
    alignItems: "center",
    padding: "0 2px",
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
  ".cm-inlineControls .diff-revert svg": {
    pointerEvents: "none",
  },
});

/** Everything the inline diff's editor needs on top of the read-only base. */
export function inlineDiffExtensions(options: InlineViewOptions): Extension[] {
  const { doc, collapse, control, onControl } = options;
  const kinds = lineKinds(doc);
  const decorations = StateField.define<DecorationSet>({
    create: (state) => changeDecorations(state, doc, kinds),
    update: (value) => value,
    provide: (field) => EditorView.decorations.from(field),
  });
  return [
    inlineTheme,
    EditorView.editorAttributes.of({ class: "cm-inlineDiff" }),
    decorations,
    numberGutter("old", doc, kinds),
    numberGutter("new", doc, kinds),
    control ? controlGutter(doc, control, onControl) : [],
    collapse ? collapsedField(collapsedRuns(doc, 3, 4)) : [],
  ];
}
