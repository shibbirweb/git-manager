<!-- A group of options under a legend, like Pull's "Integrate the incoming changes with" and its choices. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    legend: string;
    disabled?: boolean;
    legendTone?: "faint" | "dim";
    children: Snippet;
  }

  let { legend, disabled = false, legendTone = "faint", children }: Props = $props();
</script>

<fieldset class="fieldset" {disabled}>
  <legend class={legendTone}>{legend}</legend>
  {@render children()}
</fieldset>

<style>
  .fieldset {
    display: flex;
    flex-direction: column;
    gap: var(--fieldset-gap);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: var(--fieldset-legend-gap);
    color: var(--text-faint);
    font-size: var(--font-size-small);
  }

  /* A legend in a small form, like Commit Options' GPG sign. */
  legend.dim {
    color: var(--text-dim);
  }

  .fieldset:disabled {
    opacity: 0.55;
  }
</style>
