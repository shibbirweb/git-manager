<!-- A labelled form field: the label above, the control, then a hint or an error under it. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    hint?: string;
    error?: string | null;
    children: Snippet;
  }

  let { label = "", hint = "", error = null, children }: Props = $props();
</script>

<label class="field">
  {#if label}
    <span>{label}</span>
  {/if}
  {@render children()}
  {#if error}
    <span class="error" role="alert">{error}</span>
  {:else if hint}
    <span class="hint">{hint}</span>
  {/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--field-gap);
  }

  .error {
    margin-top: calc(var(--field-error-gap) - var(--field-gap));
    color: var(--danger);
    font-size: var(--font-size-small);
  }

  .hint {
    font-size: var(--font-size-small);
    color: var(--text-dim);
    line-height: 1.45;
  }
</style>
