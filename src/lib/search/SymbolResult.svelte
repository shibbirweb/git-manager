<!-- One class or symbol in the Search Everywhere popup: kind badge, name, container and file. -->
<script lang="ts">
  import HighlightText from "@nibtree/ui/components/HighlightText.svelte";
  import Spacer from "@nibtree/ui/components/Spacer.svelte";
  import SymbolBadge from "@nibtree/ui/components/SymbolBadge.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { partsToRanges } from "@nibtree/ui/logic/highlight";
  import type { SymbolRow } from "./symbolSearchModel";

  let { symbol }: { symbol: SymbolRow } = $props();

  const name = $derived(partsToRanges(symbol.nameParts));
  const container = $derived(partsToRanges(symbol.containerParts));
</script>

<SymbolBadge letter={symbol.kind.letter} tone={symbol.kind.tone} title={symbol.kind.label} />
<Text truncate><HighlightText text={name.text} ranges={name.ranges} /></Text>
{#if symbol.containerParts.length > 0}
  <Text size="small" tone="dim" truncate>in <HighlightText text={container.text} ranges={container.ranges} /></Text>
{/if}
<Spacer />
<Text size="small" tone="faint" truncate>{symbol.location}</Text>
