<!-- A side column inside a view or dialog, such as Local History's list of versions: a set width, its own scroll,
     a tinted background and a line on the side it meets the content. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { presetVar, type ColumnWidth } from "../logic/presets";

  interface Props {
    label: string;
    width?: ColumnWidth;
    side?: "left" | "right";
    line?: "strong" | "soft";
    children: Snippet;
  }

  let { label, width = "large", side = "left", line = "strong", children }: Props = $props();
</script>

<div class="pane {side} {line}" role="region" aria-label={label} style:width={presetVar("columnWidth", width)}>
  {@render children()}
</div>

<style>
  /* A column, so a growing Stack inside can push what follows to the bottom (the welcome sidebar's links). */
  .pane {
    flex: none;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: var(--pane-padding-top) 0 var(--pane-padding-bottom);
    background: var(--panel-alt);
    outline: none;
  }

  .left {
    border-right: 1px solid var(--border-strong);
  }

  .right {
    border-left: 1px solid var(--border-strong);
  }

  /* A softer line, like the welcome screen's sidebar. */
  .left.soft {
    border-right-color: var(--border);
  }

  .right.soft {
    border-left-color: var(--border);
  }
</style>
