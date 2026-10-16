<!-- Text with its matched characters shown: `strong` makes them bold in the accent color (quick open, recent
     files), `mark` gives them a tinted background (search results), `search` a warning tint (Settings search). -->
<script lang="ts">
  import { highlightParts } from "../logic/highlight";

  interface Props {
    text: string;
    ranges: [number, number][];
    variant?: "strong" | "mark" | "search";
  }

  let { text, ranges, variant = "strong" }: Props = $props();

  const parts = $derived(highlightParts(text, ranges));
</script>

<span class="highlight">
  {#each parts as part, index (index)}
    {#if !part.match}{part.text}{:else if variant === "strong"}<b>{part.text}</b>{:else}<mark class={variant}
        >{part.text}</mark
      >{/if}
  {/each}
</span>

<style>
  .highlight {
    min-width: 0;
  }

  b {
    font-weight: var(--font-weight-semibold);
    color: var(--accent);
  }

  mark {
    background: var(--diff-inline);
    color: inherit;
    border-radius: var(--radius-tiny);
  }

  /* Settings search: the words a search found, in the warning tint so they stand out from the selection. */
  .search {
    background: color-mix(in srgb, var(--warning) 40%, transparent);
    border-radius: 0;
  }
</style>
