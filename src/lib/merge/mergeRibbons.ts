// The connector ribbons of the merge tool: for each open chunk on screen, where its lines are in a side's editor and
// in the result's, in pixels from the top of MergeFrame's panes. Chunks off screen are left out, so a long file
// draws only what shows.
import type { EditorView } from "@codemirror/view";
import type { ConnectorRibbon } from "@git-manager/ui/components/MergeConnector.svelte";
import { changeType, type ChunkState, sideChanged, type SideName, sideRange } from "./model";

export interface Span {
  top: number;
  bottom: number;
}

/** Lines [start, end) of an editor; an empty range is the gap before line `start`. */
export function span(view: EditorView, start: number, end: number, originTop: number): Span {
  const text = view.state.doc;
  const lineCount = text.lines;
  let top: number;
  let bottom: number;
  if (start < end) {
    top = view.lineBlockAt(text.line(Math.min(start + 1, lineCount)).from).top;
    bottom = view.lineBlockAt(text.line(Math.min(end, lineCount)).from).bottom;
  } else if (start < lineCount) {
    top = view.lineBlockAt(text.line(start + 1).from).top;
    bottom = top;
  } else {
    top = view.lineBlockAt(text.line(lineCount).from).bottom;
    bottom = top;
  }
  const offset = view.documentTop - originTop;
  return { top: top + offset, bottom: bottom + offset };
}

export function visibleLines(view: EditorView): [number, number] {
  const text = view.state.doc;
  return [text.lineAt(view.viewport.from).number - 1, text.lineAt(view.viewport.to).number];
}

export function overlaps(start: number, end: number, visible: [number, number]): boolean {
  return end >= visible[0] && start <= visible[1];
}

/**
 * Ribbons between a side and the result. They run left to right: ours to the result on the left, the result to
 * theirs on the right. `originTop` and `height` are the panes' box.
 */
export function ribbonsFor(
  chunks: ChunkState[],
  side: SideName,
  views: { side: EditorView; result: EditorView },
  originTop: number,
  height: number,
): ConnectorRibbon[] {
  const sideVisible = visibleLines(views.side);
  const resultVisible = visibleLines(views.result);
  const ribbons: ConnectorRibbon[] = [];
  for (const chunk of chunks) {
    const done = side === "ours" ? chunk.oursDone : chunk.theirsDone;
    if (done || !sideChanged(chunk, side)) {
      continue;
    }
    const range = sideRange(chunk, side);
    if (
      !overlaps(range.start, range.end, sideVisible) &&
      !overlaps(chunk.result.start, chunk.result.end, resultVisible)
    ) {
      continue;
    }
    const sideSpan = span(views.side, range.start, range.end, originTop);
    const resultSpan = span(views.result, chunk.result.start, chunk.result.end, originTop);
    if (Math.max(sideSpan.bottom, resultSpan.bottom) < -40 || Math.min(sideSpan.top, resultSpan.top) > height + 40) {
      continue;
    }
    const [a, b] = side === "ours" ? [sideSpan, resultSpan] : [resultSpan, sideSpan];
    ribbons.push({
      index: chunk.id,
      kind: changeType(chunk, side),
      aTop: a.top,
      aBottom: a.bottom,
      bTop: b.top,
      bBottom: b.bottom,
      append: chunk.kind === "conflict" && chunk.applied,
    });
  }
  return ribbons;
}
