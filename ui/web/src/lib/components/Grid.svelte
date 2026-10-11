<!-- A grid of equal columns with a gap from the spacing steps: a fixed count, or as many as fit at `minColumn` px
     (the design tokens' grid.minColumn by default). Use it for cards and swatches; use Stack for rows and columns. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { gapValue, type Gap } from "../logic/scale";
  import { grid } from "../styles/tokens";

  interface Props {
    columns?: number | "auto";
    minColumn?: number;
    gap?: Gap;
    label?: string;
    children: Snippet;
  }

  let { columns = "auto", minColumn = grid.minColumn, gap = "lg", label, children }: Props = $props();

  const template = $derived(
    columns === "auto" ? `repeat(auto-fill, minmax(${minColumn}px, 1fr))` : `repeat(${columns}, minmax(0, 1fr))`,
  );
</script>

<div
  class="grid"
  role={label ? "group" : undefined}
  aria-label={label}
  style:grid-template-columns={template}
  style:gap={gapValue(gap)}
>
  {@render children()}
</div>

<style>
  .grid {
    display: grid;
    align-self: stretch;
    min-width: 0;
  }
</style>
