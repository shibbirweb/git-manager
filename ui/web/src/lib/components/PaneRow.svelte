<!-- Views side by side in one panel, like split terminals: each pane takes its share of the width, a line parts
     them, and the focused pane has an accent line along its top. With `onresize`, a handle between two panes moves
     their split; each pane keeps the pane preset's smallest width. -->
<script lang="ts" generics="P extends { key: string; share: number }">
  import type { Snippet } from "svelte";
  import { scales } from "../styles/tokens";
  import ResizeHandle from "./ResizeHandle.svelte";

  interface Props {
    panes: P[];
    focused?: string | null;
    resizeLabel?: string;
    pane: Snippet<[P, number]>;
    onresize?: (index: number, share: number, minShare: number) => void;
  }

  let { panes, focused = null, resizeLabel = "Resize panes", pane, onresize }: Props = $props();

  let width = $state(0);
  const total = $derived(panes.reduce((sum, entry) => sum + entry.share, 0) || 1);
  const minWidth = scales.panelMin.pane;

  /** A pane's width in px. */
  const widthOf = (index: number) => ((panes[index]?.share ?? 0) / total) * width;
</script>

<div class="panes" bind:clientWidth={width}>
  {#each panes as entry, index (entry.key)}
    {#if index > 0 && onresize && width > 0}
      {@const pair = widthOf(index - 1) + widthOf(index)}
      <ResizeHandle
        preset="pane"
        label={resizeLabel}
        side="left"
        inPanel
        size={widthOf(index - 1)}
        max={Math.max(minWidth, pair - minWidth)}
        defaultSize={pair / 2}
        onresize={(size) => onresize(index - 1, size / width, minWidth / width)}
      />
    {/if}
    <div
      class="pane"
      class:after-first={index > 0}
      class:focused={focused === entry.key && panes.length > 1}
      style:flex="{entry.share} 1 0"
    >
      {@render pane(entry, index)}
    </div>
  {/each}
</div>

<style>
  .panes {
    position: absolute;
    inset: 0;
    display: flex;
  }

  .pane {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }

  .after-first {
    border-left: 1px solid var(--border-strong);
  }

  .focused::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: 2;
    height: var(--pane-row-focus-line);
    background: var(--accent);
    pointer-events: none;
  }
</style>
