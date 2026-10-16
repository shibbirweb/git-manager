// Line-based scroll sync between the Markdown source and its preview. Rendered
// blocks carry the first source line they come from (`data-line`); positions
// between two blocks are interpolated, both ways, with the document start and
// end as fixed points.

export interface LineAnchor {
  /** 0-based source line. */
  line: number;
  /** Offset of the rendered block from the top of the preview content, in pixels. */
  top: number;
}

/** Anchors in document order with strictly increasing lines and tops that never go back. */
export function buildAnchors(blocks: LineAnchor[]): LineAnchor[] {
  const anchors: LineAnchor[] = [];
  for (const block of blocks) {
    const last = anchors[anchors.length - 1];
    if (!last || (block.line > last.line && block.top >= last.top)) {
      anchors.push(block);
    }
  }
  return anchors;
}

/** The anchors with the document start and end added; `totalLines` and `height` are the end. */
function withEnds(anchors: LineAnchor[], totalLines: number, height: number): LineAnchor[] {
  const points: LineAnchor[] = [];
  if (!anchors[0] || anchors[0].line > 0) {
    points.push({ line: 0, top: 0 });
  }
  points.push(...anchors);
  const last = points[points.length - 1];
  if (totalLines > last.line && height >= last.top) {
    points.push({ line: totalLines, top: height });
  }
  return points;
}

/** Index of the last point whose key is at most `value` (0 when none is); points are sorted by key. */
function lastAtMost(points: LineAnchor[], key: "line" | "top", value: number): number {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (points[middle][key] <= value) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

function interpolate(from: number, to: number, fromValue: number, toValue: number, at: number): number {
  if (to === from) {
    return fromValue;
  }
  return fromValue + ((at - from) / (to - from)) * (toValue - fromValue);
}

/** Preview offset for a (fractional) source line. */
export function offsetForLine(anchors: LineAnchor[], line: number, totalLines: number, height: number): number {
  const points = withEnds(anchors, totalLines, height);
  const index = lastAtMost(points, "line", line);
  const start = points[index];
  const end = points[index + 1];
  if (!end) {
    return start.top;
  }
  return interpolate(start.line, end.line, start.top, end.top, line);
}

/** (Fractional) source line shown at a preview offset. */
export function lineForOffset(anchors: LineAnchor[], offset: number, totalLines: number, height: number): number {
  const points = withEnds(anchors, totalLines, height);
  const index = lastAtMost(points, "top", offset);
  const start = points[index];
  const end = points[index + 1];
  if (!end) {
    return start.line;
  }
  return interpolate(start.top, end.top, start.line, end.line, offset);
}
