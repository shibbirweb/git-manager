<!-- A bordered box that groups rows, like a worktree card in the AI panel. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    padded?: boolean;
    children: Snippet;
  }

  let { label, padded = false, children }: Props = $props();
</script>

<section class="card" class:padded aria-label={label}>
  {@render children()}
</section>

<style>
  .card {
    align-self: stretch;
    padding: var(--card-padding-y) 0;
    border: 1px solid var(--border);
    border-radius: var(--card-radius);
    background: var(--panel);
  }

  .padded {
    padding: var(--space-6);
  }
</style>
