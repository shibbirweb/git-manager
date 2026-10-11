<!-- A Settings row: the title and hint on the left, the control on the right (or under them when stacked). -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    hint?: string;
    stacked?: boolean;
    hintContent?: Snippet;
    children: Snippet;
  }

  let { title, hint = "", stacked = false, hintContent, children }: Props = $props();
</script>

<div class="row" class:stacked>
  <div class="label">
    <span class="title">{title}</span>
    {#if hintContent}
      <span class="hint">{@render hintContent()}</span>
    {:else if hint}
      <span class="hint">{hint}</span>
    {/if}
  </div>
  {@render children()}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--setting-row-gap);
    padding: var(--setting-row-padding-y) 0;
    border-bottom: 1px solid var(--border);
  }

  .stacked {
    flex-direction: column;
    align-items: stretch;
    gap: var(--setting-row-stacked-gap);
  }

  .label {
    display: flex;
    flex-direction: column;
    gap: var(--setting-row-label-gap);
    min-width: 0;
  }

  .title {
    font-weight: var(--font-weight-medium);
  }

  .hint {
    font-size: var(--font-size-small);
    color: var(--text-dim);
    line-height: 1.45;
  }
</style>
