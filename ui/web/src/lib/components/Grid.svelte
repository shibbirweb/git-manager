<!-- A grid of equal columns with a gap from the spacing steps: a fixed count, or as many as fit at `minColumn` px
     (a named column width). Use it for cards and swatches; use Stack for rows and columns. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { GRID_COLUMNS, presetVar, type ColumnWidth, type GridColumns } from "../logic/presets";
  import { gapValue, type Gap } from "../logic/scale";

  interface Props {
    columns?: GridColumns;
    minColumn?: ColumnWidth;
    gap?: Gap;
    label?: string;
    children: Snippet;
  }

  let { columns = "auto", minColumn = "medium", gap = "lg", label, children }: Props = $props();

  const template = $derived(
    columns === "auto"
      ? `repeat(auto-fill, minmax(${presetVar("columnWidth", minColumn)}, 1fr))`
      : `repeat(${GRID_COLUMNS[columns]}, minmax(0, 1fr))`,
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
