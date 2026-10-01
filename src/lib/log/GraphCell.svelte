<script lang="ts" module>
  export const LANE_GAP = 14;
  export const GRAPH_PAD = 9;
  export const MAX_GRAPH_LANES = 24;

  // Mid-tone hues that keep contrast on both light and dark panels.
  export const LANE_COLORS = [
    "#4a8af4",
    "#e0604f",
    "#3aa55d",
    "#d9a21b",
    "#a46ee8",
    "#1fb1b5",
    "#e2639f",
    "#e8883a",
  ];

  export function graphColumnWidth(laneCount: number): number {
    const lanes = Math.min(Math.max(1, laneCount), MAX_GRAPH_LANES);
    return GRAPH_PAD * 2 + (lanes - 1) * LANE_GAP;
  }
</script>

<script lang="ts">
  import { SEGMENT_IN, SEGMENT_OUT, type GraphRow } from "./graph";

  interface Props {
    row: GraphRow;
    laneCount: number;
    height: number;
    isHead?: boolean;
    isMerge?: boolean;
    /** Only draw the node (used while filtering, where lines would not connect). */
    nodeOnly?: boolean;
  }

  let { row, laneCount, height, isHead = false, isMerge = false, nodeOnly = false }: Props = $props();

  const width = $derived(graphColumnWidth(nodeOnly ? 1 : laneCount));
  const mid = $derived(height / 2);
  const nodeX = $derived(nodeOnly ? GRAPH_PAD : laneX(row.lane));

  function laneX(lane: number): number {
    return GRAPH_PAD + lane * LANE_GAP;
  }

  function colorOf(index: number): string {
    return LANE_COLORS[index % LANE_COLORS.length] ?? LANE_COLORS[0];
  }

  const paths = $derived.by(() => {
    if (nodeOnly) {
      return [];
    }
    const result: { d: string; color: string }[] = [];
    const edges = row.edges;
    for (let index = 0; index + 3 < edges.length; index += 4) {
      const kind = edges[index];
      const x1 = laneX(edges[index + 1]);
      const x2 = laneX(edges[index + 2]);
      let d: string;
      if (kind === SEGMENT_IN) {
        d = x1 === x2 ? `M${x1} 0V${mid}` : `M${x1} 0C${x1} ${mid} ${x2} 0 ${x2} ${mid}`;
      } else if (kind === SEGMENT_OUT) {
        d = x1 === x2 ? `M${x1} ${mid}V${height}` : `M${x1} ${mid}C${x1} ${height} ${x2} ${mid} ${x2} ${height}`;
      } else {
        d = `M${x1} 0V${height}`;
      }
      result.push({ d, color: colorOf(edges[index + 3]) });
    }
    return result;
  });
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
  {#each paths as path, index (index)}
    <path d={path.d} stroke={path.color} />
  {/each}
  {#if isHead}
    <circle class="halo" cx={nodeX} cy={mid} r="7.5" stroke={colorOf(row.color)} />
  {/if}
  {#if isMerge}
    <circle class="ring" cx={nodeX} cy={mid} r="4" stroke={colorOf(row.color)} />
  {:else}
    <circle cx={nodeX} cy={mid} r={isHead ? 4.5 : 4} fill={colorOf(row.color)} />
  {/if}
</svg>

<style>
  svg {
    display: block;
    flex: none;
    overflow: hidden;
  }

  path {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .ring {
    fill: var(--row-bg, var(--panel));
    stroke-width: 2;
  }

  .halo {
    fill: none;
    stroke-width: 1.5;
    opacity: 0.45;
  }
</style>
