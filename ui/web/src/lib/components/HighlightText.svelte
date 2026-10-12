<!-- Text with its matched characters shown: `strong` makes them bold in the accent color (quick open, recent
     files), `mark` gives them a tinted background (search results). -->
<script lang="ts">
  import { highlightParts } from "../logic/highlight";

  interface Props {
    text: string;
    ranges: [number, number][];
    variant?: "strong" | "mark";
  }

  let { text, ranges, variant = "strong" }: Props = $props();

  const parts = $derived(highlightParts(text, ranges));
</script>

<span class="highlight">
  {#each parts as part, index (index)}
    {#if !part.match}{part.text}{:else if variant === "mark"}<mark>{part.text}</mark>{:else}<b>{part.text}</b>{/if}
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
</style>
