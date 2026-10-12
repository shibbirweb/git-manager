<!-- A bordered, scrolling box on the editor background that holds a list inside a dialog, such as a push's commits
     or the remotes. Rows inside draw their own lines; the last one has none. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { presetVar, type ViewHeight } from "../logic/presets";

  interface Props {
    label: string;
    maxHeight?: Exclude<ViewHeight, "fill"> | "none";
    minHeight?: "none" | "list";
    children: Snippet;
  }

  let { label, maxHeight = "none", minHeight = "none", children }: Props = $props();
</script>

<div
  class="list-box"
  class:tall={minHeight === "list"}
  role="list"
  aria-label={label}
  style:max-height={maxHeight === "none" ? null : presetVar("viewHeight", maxHeight)}
>
  {@render children()}
</div>

<style>
  .list-box {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--editor-bg);
  }

  /* Room for an empty or loading state before the rows arrive. */
  .tall {
    min-height: var(--list-box-min-height);
  }

  .list-box > :global(:last-child) {
    border-bottom: none;
  }
</style>
