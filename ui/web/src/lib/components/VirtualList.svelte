<!-- A long list that draws only the rows in view, for thousands of rows (files, commits). Rows have one fixed
     height. `keepInView` scrolls a row into view when it changes, like a keyboard selection. -->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { RowHeight, ViewHeight } from "../logic/presets";
  import { scrollToShow, visibleRows } from "../logic/virtualWindow";
  import { scales } from "../styles/tokens";

  interface Props {
    items: T[];
    rowHeight?: RowHeight;
    label: string;
    keepInView?: number | null;
    height?: ViewHeight;
    row: Snippet<[T, number]>;
  }

  let { items, rowHeight = "normal", label, keepInView = null, height = "fill", row }: Props = $props();

  // Rows drawn beyond the view on each side, so fast scrolling does not show gaps.
  const OVERSCAN = 8;
  const rowPx = $derived(scales.rowHeight[rowHeight]);

  let viewport = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  const range = $derived(visibleRows(scrollTop, viewportHeight, rowPx, items.length, OVERSCAN));

  $effect(() => {
    if (keepInView === null || !viewport) {
      return;
    }
    const target = scrollToShow(keepInView, rowPx, viewport.scrollTop, viewport.clientHeight);
    if (target !== null) {
      viewport.scrollTop = target;
    }
  });
</script>

<div
  bind:this={viewport}
  bind:clientHeight={viewportHeight}
  class="viewport"
  class:fixed={height !== "fill"}
  style:height={height === "fill" ? null : `${scales.viewHeight[height]}px`}
  role="list"
  aria-label={label}
  onscroll={() => (scrollTop = viewport?.scrollTop ?? 0)}
>
  <div class="spacer" style:height="{items.length * rowPx}px">
    {#each items.slice(range.first, range.last) as item, offset (range.first + offset)}
      <div class="slot" role="listitem" style:top="{(range.first + offset) * rowPx}px"
        style:height="{rowPx}px">
        {@render row(item, range.first + offset)}
      </div>
    {/each}
  </div>
</div>

<style>
  .viewport {
    flex: 1;
    width: 100%;
    min-height: 0;
    overflow-y: auto;
    outline: none;
  }

  .fixed {
    flex: none;
  }

  .spacer {
    position: relative;
  }

  .slot {
    position: absolute;
    left: 0;
    right: 0;
  }
</style>
