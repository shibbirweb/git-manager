<!-- A small "more memory" mark beside a setting's name, with the measured cost (memoryCost.ts). -->
<script lang="ts">
  import Pill from "@git-manager/ui/components/Pill.svelte";
  import type { Preferences } from "$lib/stores/settings.svelte";
  import { memoryCost, memoryFlagTitle } from "./memoryCost";

  let { setting }: { setting: keyof Preferences } = $props();

  const cost = $derived(memoryCost(setting));
</script>

{#if cost}
  <Pill variant="outline" tone={cost.minor ? "neutral" : "warning"} title={memoryFlagTitle(cost)}>{cost.amount}</Pill>
{/if}
