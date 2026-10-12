<!-- The label that follows the pointer while files are dragged, such as "3 files" in the Files panel. `x` and `y`
     are the pointer's position (data); the ghost sits just below and to the right of it. -->
<script lang="ts">
  interface Props {
    text: string;
    x: number;
    y: number;
  }

  let { text, x, y }: Props = $props();
</script>

<div class="drag-ghost" aria-hidden="true" style:left="{x}px" style:top="{y}px">{text}</div>

<style>
  .drag-ghost {
    position: fixed;
    z-index: 1000;
    max-width: var(--drag-ghost-max-width);
    padding: var(--drag-ghost-padding-y) var(--drag-ghost-padding-x);
    overflow: hidden;
    transform: translate(var(--drag-ghost-offset-x), var(--drag-ghost-offset-y));
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--panel);
    box-shadow: var(--shadow);
    color: var(--text);
    font-size: var(--font-size-small);
    white-space: nowrap;
    text-overflow: ellipsis;
    pointer-events: none;
  }
</style>
