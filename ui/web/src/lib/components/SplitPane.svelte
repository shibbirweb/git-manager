<!-- Two panes side by side (or one above the other) with a ResizeHandle between them. `size` is the first pane's
     width or height in px and the second takes the rest, or the other way round with `sized="second"`. Without
     `second` the first pane is shown alone and stays mounted, so its content does not move. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { PanelPreset } from "../logic/presets";
  import ResizeHandle from "./ResizeHandle.svelte";

  interface Props {
    direction?: "row" | "column";
    size: number;
    sized?: "first" | "second";
    preset?: PanelPreset;
    max?: number;
    label: string;
    /** Its own measured width (row) or height (column), so the app can work out `max`. */
    extent?: number;
    /** Between views inside one panel: the handle keeps its size in rounded looks. */
    inPanel?: boolean;
    oncommit?: (size: number) => void;
    first: Snippet;
    second?: Snippet;
  }

  let {
    direction = "row",
    size = $bindable(),
    sized = "first",
    preset = "pane",
    max = 800,
    label,
    extent = $bindable(0),
    inPanel = false,
    oncommit,
    first,
    second,
  }: Props = $props();

  // The handle's side is where the sized pane sits, relative to it.
  const handleSide = $derived(
    direction === "row" ? (sized === "first" ? "left" : "right") : sized === "first" ? "top" : "bottom",
  );

  function basis(pane: "first" | "second"): string | null {
    return pane === sized && second ? `${size}px` : null;
  }
</script>

{#snippet panes()}
  <div class="first" class:rest={sized === "second" || !second} style:flex-basis={basis("first")}>
    {@render first()}
  </div>
  {#if second}
    <ResizeHandle
      {size}
      side={handleSide}
      {preset}
      {max}
      {label}
      {inPanel}
      onresize={(next) => (size = next)}
      {oncommit}
    />
    <div class="second" class:rest={sized === "first"} style:flex-basis={basis("second")}>{@render second()}</div>
  {/if}
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
    flex: none;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-left: 1px solid var(--border-strong);
  }

  /* The pane that takes the rest of the room. */
  .rest {
    flex: 1;
  }

  .column .second {
    border-left: none;
    border-top: 1px solid var(--border-strong);
  }
</style>
