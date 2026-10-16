<!-- A short bulleted list of facts, such as the settings changed from their defaults. Put Text (or code) in each
     item; an empty list shows `emptyText` dim. -->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";

  interface Props {
    items: T[];
    label?: string;
    emptyText?: string;
    item: Snippet<[T]>;
  }

  let { items, label, emptyText = "", item }: Props = $props();
</script>

<ul class="list" aria-label={label}>
  {#each items as entry, index (index)}
    <li>{@render item(entry)}</li>
  {:else}
    {#if emptyText}<li class="empty">{emptyText}</li>{/if}
  {/each}
</ul>

<style>
  .list {
    margin: 0;
    padding-left: var(--bullet-list-indent);
    font-size: var(--font-size-code-small);
    line-height: var(--line-height-airy);
  }

  .empty {
    color: var(--text-dim);
  }
</style>
