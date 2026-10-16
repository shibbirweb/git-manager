// Synchronized scrolling of the merge tool's three editors: the line at the center of the scrolled pane is mapped
// through the chunks to the others, so matching lines stay side by side even where a side has more lines.
import type { EditorView } from "@codemirror/view";
import { type ChunkState, invertAnchors, mapLine, sideToResultAnchors } from "./model";

export type Pane = "ours" | "result" | "theirs";

/** The line (with a fraction) at the vertical center of an editor. */
export function lineAtCenter(view: EditorView): number {
  const scroller = view.scrollDOM;
  const scrollRect = scroller.getBoundingClientRect();
  const docOffset = view.documentTop - scrollRect.top + scroller.scrollTop;
  const height = scroller.scrollTop + scroller.clientHeight / 2 - docOffset;
  const block = view.lineBlockAtHeight(Math.max(0, height));
  const index = view.state.doc.lineAt(block.from).number - 1;
  const fraction = block.height > 0 ? Math.min(1, Math.max(0, (height - block.top) / block.height)) : 0;
  return index + fraction;
}

export function scrollToLine(view: EditorView, position: number): void {
  const text = view.state.doc;
  const index = Math.max(0, Math.min(text.lines - 1, Math.floor(position)));
  const fraction = Math.max(0, Math.min(1, position - index));
  const block = view.lineBlockAt(text.line(index + 1).from);
  const scroller = view.scrollDOM;
  const scrollRect = scroller.getBoundingClientRect();
  const docOffset = view.documentTop - scrollRect.top + scroller.scrollTop;
  scroller.scrollTop = docOffset + block.top + fraction * block.height - scroller.clientHeight / 2;
}

export class ScrollSync {
  /** The pane being scrolled by the user; the scroll events of the panes that follow it are skipped. */
  #lock: Pane | null = null;
  #unlockFrame = 0;

  /** `source` scrolled: the other two follow it. */
  follow(source: Pane, views: Record<Pane, EditorView>, chunks: ChunkState[]): void {
    if (this.#lock && this.#lock !== source) {
      return;
    }
    this.#lock = source;
    cancelAnimationFrame(this.#unlockFrame);
    const position = lineAtCenter(views[source]);
    const resultLines = views.result.state.doc.lines;
    const oursAnchors = sideToResultAnchors(chunks, "ours", views.ours.state.doc.lines, resultLines);
    const theirsAnchors = sideToResultAnchors(chunks, "theirs", views.theirs.state.doc.lines, resultLines);
    const resultPosition =
      source === "result" ? position : mapLine(position, source === "ours" ? oursAnchors : theirsAnchors);
    if (source !== "result") {
      scrollToLine(views.result, resultPosition);
    }
    if (source !== "ours") {
      scrollToLine(views.ours, mapLine(resultPosition, invertAnchors(oursAnchors)));
    }
    if (source !== "theirs") {
      scrollToLine(views.theirs, mapLine(resultPosition, invertAnchors(theirsAnchors)));
    }
    this.#unlockFrame = requestAnimationFrame(() => {
      this.#unlockFrame = requestAnimationFrame(() => {
        this.#lock = null;
      });
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.#unlockFrame);
  }
}
