// The log graph's drawing for one row (the app's log uses it): lanes LANE_GAP apart after GRAPH_PAD,
// edges as quadruples [kind, from lane, to lane, color] (pass: top to bottom, in: top to the node, out: the node to
// the bottom), colors cycling through the palette's lane colors.
import { componentTokens } from "../styles/tokens";
import { scales } from "../styles/tokens";

export const SEGMENT_PASS = 0;
export const SEGMENT_IN = 1;
export const SEGMENT_OUT = 2;
export const MAX_GRAPH_LANES = 24;
export const LANE_COLOR_COUNT = 8;

export interface GraphRowData {
  /** Column of the commit node. */
  lane: number;
  /** Color index of the node. */
  color: number;
  /** Flat [kind, from, to, color] quadruples. */
  edges: ArrayLike<number>;
}

const { laneGap, pad } = componentTokens.commitGraph;

export function laneX(lane: number): number {
  return pad + lane * laneGap;
}

export function graphWidth(laneCount: number): number {
  const lanes = Math.min(Math.max(1, laneCount), MAX_GRAPH_LANES);
  return pad * 2 + (lanes - 1) * laneGap;
}

/** The palette variable of a color index. */
export function laneColor(index: number): string {
  return `var(--palette-graph-lane-${(((index % LANE_COLOR_COUNT) + LANE_COLOR_COUNT) % LANE_COLOR_COUNT) + 1})`;
}

export function graphPaths(row: GraphRowData, height: number): { d: string; color: string }[] {
  const mid = height / 2;
  const paths: { d: string; color: string }[] = [];
  for (let index = 0; index + 3 < row.edges.length; index += 4) {
    const kind = row.edges[index];
    const x1 = laneX(row.edges[index + 1]);
    const x2 = laneX(row.edges[index + 2]);
    let d: string;
    if (kind === SEGMENT_IN) {
      d = x1 === x2 ? `M${x1} 0V${mid}` : `M${x1} 0C${x1} ${mid} ${x2} 0 ${x2} ${mid}`;
    } else if (kind === SEGMENT_OUT) {
      d = x1 === x2 ? `M${x1} ${mid}V${height}` : `M${x1} ${mid}C${x1} ${height} ${x2} ${mid} ${x2} ${height}`;
    } else {
      d = `M${x1} 0V${height}`;
    }
    paths.push({ d, color: laneColor(row.edges[index + 3]) });
  }
  return paths;
}

/** The row height a graph cell draws at, from a named row height. */
export function graphHeight(rowHeight: keyof typeof scales.rowHeight): number {
  return scales.rowHeight[rowHeight];
}
