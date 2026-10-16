<!-- A bordered box that groups rows, like a worktree card in the AI panel; `selected` marks the chosen one with an
     accent border and `dim` one whose folder is gone. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    padded?: boolean;
    selected?: boolean;
    dim?: boolean;
    children: Snippet;
  }

  let { label, padded = false, selected = false, dim = false, children }: Props = $props();
</script>

<section class="card" class:padded class:selected class:faded={dim} aria-label={label}>
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

  .selected {
    border-color: var(--accent);
  }

  /* Something that is gone or paused, such as a worktree whose folder was removed. */
  .faded {
    opacity: 0.7;
  }

  .padded {
    padding: var(--space-6);
  }
</style>
