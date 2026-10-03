// Incremental lane layout for the commit graph. Feed commits in log order
// (children before parents), page after page; lane state is kept between
// calls so the result matches laying out the whole history at once.

export const SEGMENT_PASS = 0;
export const SEGMENT_IN = 1;
export const SEGMENT_OUT = 2;

export type SegmentKind = "pass" | "in" | "out";

/**
 * A line drawn inside one row. `pass` runs from the top of lane `from` to the
 * bottom of lane `to`; `in` from the top of `from` to the node; `out` from the
 * node to the bottom of `to`.
 */
export interface GraphSegment {
  kind: SegmentKind;
  from: number;
  to: number;
  color: number;
}

export interface GraphRow {
  /** Column of the commit node. */
  lane: number;
  /** Color index of the node. */
  color: number;
  /** Number of lane columns this row needs. */
  width: number;
  /**
   * Flat [kind, from, to, color] quadruples in a typed array: 100k rows of 20 lanes held about
   * 90 MB as arrays of numbers and about 31 MB this way.
   */
  edges: GraphEdges;
}

/** 16-bit lanes; a row of more than 32767 lanes (never seen) gets 32-bit ones. */
export type GraphEdges = Int16Array | Int32Array;

const MAX_INT16 = 32767;

export interface GraphCommit {
  id: string;
  parents: readonly string[];
}

interface Lane {
  expect: string;
  color: number;
}

const KIND_NAMES: SegmentKind[] = ["pass", "in", "out"];

export function rowSegments(row: GraphRow): GraphSegment[] {
  const segments: GraphSegment[] = [];
  for (let index = 0; index + 3 < row.edges.length; index += 4) {
    segments.push({
      kind: KIND_NAMES[row.edges[index]] ?? "pass",
      from: row.edges[index + 1],
      to: row.edges[index + 2],
      color: row.edges[index + 3],
    });
  }
  return segments;
}

export class GraphBuilder {
  private lanes: (Lane | null)[] = [];
  /** The row being built, reused so only its typed copy stays. */
  private readonly scratch: number[] = [];
  private nextColor = 0;
  private readonly colorCount: number;
  /** Widest row produced so far. */
  maxWidth = 0;

  constructor(colorCount = 8) {
    this.colorCount = Math.max(1, colorCount);
  }

  push(commits: readonly GraphCommit[]): GraphRow[] {
    const rows: GraphRow[] = [];
    for (const commit of commits) {
      rows.push(this.next(commit));
    }
    return rows;
  }

  next(commit: GraphCommit): GraphRow {
    const lanes = this.lanes;
    const edges = this.scratch;
    edges.length = 0;
    const widthBefore = lanes.length;

    const incoming: number[] = [];
    for (let index = 0; index < lanes.length; index++) {
      if (lanes[index]?.expect === commit.id) {
        incoming.push(index);
      }
    }

    let lane: number;
    let color: number;
    if (incoming.length > 0) {
      lane = incoming[0];
      color = lanes[lane]?.color ?? 0;
    } else {
      lane = this.firstFree();
      color = this.allocateColor();
    }

    for (const index of incoming) {
      edges.push(SEGMENT_IN, index, lane, lanes[index]?.color ?? color);
    }
    for (let index = 0; index < lanes.length; index++) {
      const current = lanes[index];
      if (current && current.expect !== commit.id) {
        edges.push(SEGMENT_PASS, index, index, current.color);
      }
    }
    for (const index of incoming) {
      lanes[index] = null;
    }

    const parents = uniqueParents(commit.parents ?? []);
    if (parents.length > 0) {
      this.setLane(lane, { expect: parents[0], color });
      edges.push(SEGMENT_OUT, lane, lane, color);
      for (let parentIndex = 1; parentIndex < parents.length; parentIndex++) {
        const parent = parents[parentIndex];
        let target = lanes.findIndex((candidate) => candidate?.expect === parent);
        if (target === -1) {
          target = this.firstFree();
          this.setLane(target, { expect: parent, color: this.allocateColor() });
        }
        edges.push(SEGMENT_OUT, lane, target, lanes[target]?.color ?? color);
      }
    }

    const width = Math.max(widthBefore, lanes.length, lane + 1);
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop();
    }
    this.maxWidth = Math.max(this.maxWidth, width);
    const wide = width > MAX_INT16 || this.colorCount > MAX_INT16;
    const stored = wide ? Int32Array.from(edges) : Int16Array.from(edges);
    return { lane, color, width, edges: stored };
  }

  private firstFree(): number {
    const index = this.lanes.indexOf(null);
    return index === -1 ? this.lanes.length : index;
  }

  private setLane(index: number, value: Lane): void {
    while (this.lanes.length < index) {
      this.lanes.push(null);
    }
    this.lanes[index] = value;
  }

  private allocateColor(): number {
    const color = this.nextColor % this.colorCount;
    this.nextColor++;
    return color;
  }
}

function uniqueParents(parents: readonly string[]): string[] {
  const result: string[] = [];
  for (const parent of parents) {
    if (!result.includes(parent)) {
      result.push(parent);
    }
  }
  return result;
}
