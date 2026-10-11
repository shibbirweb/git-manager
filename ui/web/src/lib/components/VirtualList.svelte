<!-- A long list that draws only the rows in view, for thousands of rows (files, commits). Rows have one fixed
     height. `keepInView` scrolls a row into view when it changes, like a keyboard selection. -->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { scrollToShow, visibleRows } from "../logic/virtualWindow";

  interface Props {
    items: T[];
    rowHeight: number;
    label: string;
    overscan?: number;
    keepInView?: number | null;
    height?: "fill" | number;
    row: Snippet<[T, number]>;
  }

  let { items, rowHeight, label, overscan = 8, keepInView = null, height = "fill", row }: Props = $props();

  let viewport = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  const range = $derived(visibleRows(scrollTop, viewportHeight, rowHeight, items.length, overscan));

  $effect(() => {
    if (keepInView === null || !viewport) {
      return;
    }
    const target = scrollToShow(keepInView, rowHeight, viewport.scrollTop, viewport.clientHeight);
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
  style:height={height === "fill" ? null : `${height}px`}
  role="list"
  aria-label={label}
  onscroll={() => (scrollTop = viewport?.scrollTop ?? 0)}
>
  <div class="spacer" style:height="{items.length * rowHeight}px">
    {#each items.slice(range.first, range.last) as item, offset (range.first + offset)}
      <div class="slot" role="listitem" style:top="{(range.first + offset) * rowHeight}px" style:height="{rowHeight}px">
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
