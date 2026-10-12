<!-- A small card in the bottom right corner of a view, with a message and a button, like "The agent ended" with
     Restart over a terminal. Its parent must be positioned (TerminalView's children are). -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    message: string;
    action?: Snippet;
  }

  let { message, action }: Props = $props();
</script>

<div class="corner-card" role="status">
  <span>{message}</span>
  {@render action?.()}
</div>

<style>
  .corner-card {
    position: absolute;
    right: var(--corner-card-inset);
    bottom: var(--corner-card-inset);
    display: flex;
    align-items: center;
    gap: var(--corner-card-gap);
    padding: var(--corner-card-padding-y) var(--corner-card-padding-right) var(--corner-card-padding-y)
      var(--corner-card-padding-left);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-menu);
    background: var(--panel);
    box-shadow: var(--shadow);
    color: var(--text-dim);
    font-size: var(--font-size-small);
  }
</style>
