<!-- A small "more memory" mark beside a setting's name, with the measured cost (memoryCost.ts). -->
<script lang="ts">
  import type { Preferences } from "$lib/stores/settings.svelte";
  import { memoryCost, memoryFlagTitle } from "./memoryCost";

  let { setting }: { setting: keyof Preferences } = $props();

  const cost = $derived(memoryCost(setting));
</script>

{#if cost}
  <span class="memory-flag" class:minor={cost.minor ?? false} title={memoryFlagTitle(cost)} aria-label={memoryFlagTitle(cost)}
    >{cost.amount}</span
  >
{/if}

<style>
  .memory-flag {
    display: inline-block;
    margin-left: 6px;
    padding: 0 6px;
    border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    color: var(--warning);
    font-size: 10.5px;
    font-weight: 500;
    line-height: 16px;
    white-space: nowrap;
    vertical-align: 1px;
    cursor: help;
  }

  .memory-flag.minor {
    border-color: var(--border-strong);
    background: transparent;
    color: var(--text-dim);
  }
</style>
