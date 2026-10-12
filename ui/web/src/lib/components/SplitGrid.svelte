<!-- The editor area split into groups (Window > Split Right / Split Down): each group placed by its fractions of the
     area, a line between groups that touch (or a gap with rounded panels), and the splitters' handles on top.
     The app's split tree gives the rects; `group` and `splitter` draw them. -->
<script lang="ts" generics="G extends { id: string; rect: GridRect }">
  import type { Snippet } from "svelte";
  import { groupBox, innerEdges, splitterBox, type GridRect, type GridSplitter } from "../logic/splitGrid";

  interface Props {
    groups: G[];
    splitters?: GridSplitter[];
    look?: "flat" | "rounded";
    focused?: string | null;
    group: Snippet<[G, number]>;
    splitter?: Snippet<[GridSplitter]>;
    onfocus?: (id: string) => void;
  }

  let { groups, splitters = [], look = "flat", focused = null, group, splitter, onfocus }: Props = $props();
</script>

<div class="area {look}">
  {#each groups as entry, index (entry.id)}
    {@const box = groupBox(entry.rect)}
    {@const edges = innerEdges(entry.rect)}
    <section
      class="group"
      class:inner-left={edges.left}
      class:inner-top={edges.top}
      class:focused={focused === entry.id}
      aria-label={groups.length > 1 ? `Editor group ${index + 1}` : "Editor"}
      style:left={box.left}
      style:top={box.top}
      style:width={box.width}
      style:height={box.height}
      onfocusin={() => onfocus?.(entry.id)}
      onpointerdown={() => onfocus?.(entry.id)}
    >
      {@render group(entry, index)}
    </section>
  {/each}
  {#each splitters as line (line.id)}
    {@const box = splitterBox(line)}
    <div
      class="splitter"
      class:down={line.direction === "down"}
      style:left={box.left}
      style:top={box.top}
      style:width={box.width}
      style:height={box.height}
    >
      {@render splitter?.(line)}
    </div>
  {/each}
</div>

<style>
  .area {
    --split-grid-gap-half: 0%;
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .group {
    position: absolute;
    display: flex;
    flex-direction: column;
  }

  .inner-left {
    border-left: 1px solid var(--border-strong);
  }

  .inner-top {
    border-top: 1px solid var(--border-strong);
  }

  .splitter {
    position: absolute;
    z-index: var(--split-grid-splitter-layer);
    display: flex;
    justify-content: center;
    width: 0;
  }

  .splitter.down {
    flex-direction: column;
    width: auto;
    height: 0;
  }

  /* Rounded panels: each group is its own rounded panel, half a gap from its neighbors. */
  .rounded {
    --split-grid-gap-half: calc(var(--app-shell-panel-gap) / 2);
  }

  .rounded .group {
    border: none;
    border-radius: var(--app-shell-panel-radius);
    overflow: hidden;
    background: var(--panel);
  }
</style>
