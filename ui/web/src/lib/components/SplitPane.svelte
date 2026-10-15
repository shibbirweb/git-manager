<!-- Two panes side by side (or one above the other) with a ResizeHandle between them. `size` is the first pane's
     width or height in px; the second pane takes the rest. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { PanelPreset } from "../logic/presets";
  import ResizeHandle from "./ResizeHandle.svelte";

  interface Props {
    direction?: "row" | "column";
    size: number;
    preset?: PanelPreset;
    max?: number;
    label: string;
    /** Its own measured width (row) or height (column), so the app can work out `max`. */
    extent?: number;
    /** Between views inside one panel: the handle keeps its size in rounded looks. */
    inPanel?: boolean;
    oncommit?: (size: number) => void;
    first: Snippet;
    second: Snippet;
  }

  let {
    direction = "row",
    size = $bindable(),
    preset = "pane",
    max = 800,
    label,
    extent = $bindable(0),
    inPanel = false,
    oncommit,
    first,
    second,
  }: Props = $props();
</script>

{#snippet panes()}
  <div class="first" style:flex-basis="{size}px">{@render first()}</div>
  <ResizeHandle
    {size}
    side={direction === "row" ? "left" : "bottom"}
    {preset}
    {max}
    {label}
    {inPanel}
    onresize={(next) => (size = next)}
    {oncommit}
  />
  <div class="second">{@render second()}</div>
{/snippet}

{#if direction === "row"}
  <div class="split" bind:clientWidth={extent}>{@render panes()}</div>
{:else}
  <div class="split column" bind:clientHeight={extent}>{@render panes()}</div>
{/if}

<style>
  .split {
    flex: 1;
    display: flex;
    min-width: 0;
    min-height: 0;
    width: 100%;
  }

  .column {
    flex-direction: column;
  }

  .first {
    flex: none;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .second {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-left: 1px solid var(--border-strong);
  }

  .column .second {
    border-left: none;
    border-top: 1px solid var(--border-strong);
  }
</style>
