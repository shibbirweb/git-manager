<!-- Label and value pairs in two columns, like a commit's Author, Date and Parents. A value can be mono (hashes)
     or drawn by the `value` snippet (links, copy buttons). -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface DescriptionItem {
    label: string;
    value: string;
    mono?: boolean;
  }

  interface Props {
    items: DescriptionItem[];
    label?: string;
    value?: Snippet<[DescriptionItem]>;
  }

  let { items, label, value }: Props = $props();
</script>

<dl class="meta" aria-label={label}>
  {#each items as item (item.label)}
    <dt>{item.label}</dt>
    <dd class:mono={item.mono}>
      {#if value}{@render value(item)}{:else}{item.value}{/if}
    </dd>
  {/each}
</dl>

<style>
  .meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--description-list-row-gap) var(--description-list-column-gap);
    margin: 0;
    font-size: var(--font-size-small);
  }

  dt {
    color: var(--text-dim);
  }

  dd {
    margin: 0;
    min-width: 0;
    user-select: text;
    -webkit-user-select: text;
  }

  .mono {
    font-family: var(--font-mono);
  }
</style>
