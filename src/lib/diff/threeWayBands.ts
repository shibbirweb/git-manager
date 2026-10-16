// The connectors' bands of the 3-pane diff: each side's changes on screen, from its lines in one pane to its lines in
// the next, in pixels from the panes' box (the merge tool's span).
import type { EditorView } from "@codemirror/view";
import type { ConnectorRibbon } from "@git-manager/ui/components/MergeConnector.svelte";
import { overlaps, span, visibleLines } from "$lib/merge/mergeRibbons";
import type { LineRange } from "$lib/types";
import type { ThreeWayChange } from "./threeWay";

export function bands(
  changes: ThreeWayChange[],
  first: { view: EditorView; range: (change: ThreeWayChange) => LineRange },
  second: { view: EditorView; range: (change: ThreeWayChange) => LineRange },
  box: DOMRect,
): ConnectorRibbon[] {
  const firstVisible = visibleLines(first.view);
  const secondVisible = visibleLines(second.view);
  const ribbons: ConnectorRibbon[] = [];
  for (const change of changes) {
    const a = first.range(change);
    const b = second.range(change);
    if (!overlaps(a.start, a.end, firstVisible) && !overlaps(b.start, b.end, secondVisible)) {
      continue;
    }
    const aSpan = span(first.view, a.start, a.end, box.top);
    const bSpan = span(second.view, b.start, b.end, box.top);
    if (Math.max(aSpan.bottom, bSpan.bottom) < -40 || Math.min(aSpan.top, bSpan.top) > box.height + 40) {
      continue;
    }
    ribbons.push({
      index: change.index,
      kind: change.type,
      aTop: aSpan.top,
      aBottom: aSpan.bottom,
      bTop: bSpan.top,
      bBottom: bSpan.bottom,
    });
  }
  return ribbons;
}
