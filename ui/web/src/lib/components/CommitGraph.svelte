<!-- One row of the log's commit graph: lane lines in the palette's lane colors and the commit's node (a ring for a
     merge, a halo around HEAD). The app computes the lanes; this draws them. -->
<script lang="ts">
  import { graphHeight, graphPaths, graphWidth, laneColor, laneX, type GraphRowData } from "../logic/graphModel";
  import { componentTokens } from "../styles/tokens";

  interface Props {
    row: GraphRowData;
    laneCount: number;
    rowHeight?: "compact" | "normal" | "relaxed" | "comfortable";
    head?: boolean;
    merge?: boolean;
    nodeOnly?: boolean;
  }

  let { row, laneCount, rowHeight = "relaxed", head = false, merge = false, nodeOnly = false }: Props = $props();

  const { node, nodeHead, halo, ring } = componentTokens.commitGraph;
  const height = $derived(graphHeight(rowHeight));
  const width = $derived(graphWidth(nodeOnly ? 1 : laneCount));
  const nodeX = $derived(nodeOnly ? laneX(0) : laneX(row.lane));
  const paths = $derived(nodeOnly ? [] : graphPaths(row, height));
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
  {#each paths as path, index (index)}
    <path d={path.d} stroke={path.color} />
  {/each}
  {#if head}
    <circle class="halo" cx={nodeX} cy={height / 2} r={halo} stroke={laneColor(row.color)} />
  {/if}
  {#if merge}
    <circle class="ring" cx={nodeX} cy={height / 2} r={ring} stroke={laneColor(row.color)} />
  {:else}
    <circle cx={nodeX} cy={height / 2} r={head ? nodeHead : node} fill={laneColor(row.color)} />
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
    stroke-width: var(--commit-graph-line);
    stroke-linecap: round;
  }

  .ring {
    fill: var(--row-bg, var(--panel));
    stroke-width: var(--commit-graph-line);
  }

  .halo {
    fill: none;
    stroke-width: 1.5;
    opacity: 0.45;
  }
</style>
