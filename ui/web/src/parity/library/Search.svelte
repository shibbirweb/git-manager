<!-- The library side of the search parity cases (cases/search.ts). -->
<script lang="ts">
  import CommandPalette from "$ui/components/CommandPalette.svelte";
  import PaletteRow from "$ui/components/PaletteRow.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import SymbolBadge from "$ui/components/SymbolBadge.svelte";
  import Text from "$ui/components/Text.svelte";

  let { id }: { id: string } = $props();
  const none = () => undefined;
  const INTERFACE = { letter: "I", tone: "interface" as const };
</script>

{#if id === "search-top"}
  <CommandPalette open label="Search" items={[]} size="wide" onpick={none}>
    {#snippet scopes()}
      <Text size="compact">12 results</Text>
      <Stack label="Capped"><Text size="compact" tone="warning" truncate>Capped</Text></Stack>
    {/snippet}
    {#snippet replace()}<input aria-label="Replace" placeholder="Replace with" />{/snippet}
  </CommandPalette>
{:else if id === "quick-open-symbol"}
  <div role="listbox" aria-label="Symbols">
    <PaletteRow item={{ id: "c", title: "Cart", depth: 1, badge: INTERFACE, container: "cart.ts" }} />
    <PaletteRow item={{ id: "p", title: "", prefix: ">" }} />
  </div>
  <SymbolBadge letter="f" tone="function" />
  <SymbolBadge letter="c" tone="constant" />
{/if}
