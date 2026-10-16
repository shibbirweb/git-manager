// The 3-way merge view's chunks and connector ribbons. A chunk covers lines [start, end) in each pane (an empty
// range is a gap between lines); its lines get first/last/single edges, and the connector between two panes draws
// a ribbon from one pane's range to the other's.

export type ChunkKind = "modified" | "added" | "deleted" | "conflict";

export interface MergeChunk {
  kind: ChunkKind;
  left: [number, number];
  result: [number, number];
  right: [number, number];
}

/** The classes of line `line` in a chunk range: the chunk tint plus its top and bottom edges. */
export function chunkLineClasses(kind: ChunkKind, start: number, end: number, line: number): string {
  let edge = "";
  if (end - start === 1) {
    edge = "cm-mc-single";
  } else if (line === start) {
    edge = "cm-mc-first";
  } else if (line === end - 1) {
    edge = "cm-mc-last";
  }
  return `cm-mc-line cm-mc-${kind}${edge ? ` ${edge}` : ""}`;
}

/** A ribbon from [aTop, aBottom] on the left edge to [bTop, bBottom] on the right edge of a `width` wide column. */
export function ribbonPath(aTop: number, aBottom: number, bTop: number, bBottom: number, width: number): string {
  const mid = width / 2;
  return (
    `M0 ${aTop}C${mid} ${aTop} ${mid} ${bTop} ${width} ${bTop}` +
    `L${width} ${bBottom}C${mid} ${bBottom} ${mid} ${aBottom} 0 ${aBottom}Z`
  );
}
