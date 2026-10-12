<!-- Views side by side in one panel, like split terminals: each pane takes its share of the width, a line parts
     them, and the focused pane has an accent line along its top. Handles between panes go in `pane` as needed. -->
<script lang="ts" generics="P extends { key: string; share: number }">
  import type { Snippet } from "svelte";

  interface Props {
    panes: P[];
    focused?: string | null;
    pane: Snippet<[P, number]>;
  }

  let { panes, focused = null, pane }: Props = $props();
</script>

<div class="panes">
  {#each panes as entry, index (entry.key)}
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
