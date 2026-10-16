<!-- The bottom status bar: items on the left (repository, branch) and on the right (memory, notifications). The
     left side clips when the window is narrow; the `rounded` look puts the bar on the window frame's color. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    look?: "flat" | "rounded";
    start?: Snippet;
    end?: Snippet;
  }

  let { label = "Status bar", look = "flat", start, end }: Props = $props();
</script>

<footer class="status-bar {look}" aria-label={label}>
  <div class="side start">{@render start?.()}</div>
  <div class="side">{@render end?.()}</div>
</footer>

<style>
  .status-bar {
    flex: none;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--status-bar-gap);
    height: var(--status-bar-height);
    padding: 0 var(--space-3);
    border-top: 1px solid var(--border-strong);
    background: var(--panel-alt);
    font-size: var(--font-size-small);
    color: var(--text-dim);
  }

  /* Rounded panels: the bar is part of the window frame. */
  .rounded {
    border-top: none;
    background: var(--frame);
  }

  .side {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 1px;
  }

  .start {
    overflow: hidden;
  }
</style>
