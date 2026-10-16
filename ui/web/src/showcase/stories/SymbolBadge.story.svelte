<script lang="ts">
  import Stack from "$ui/components/Stack.svelte";
  import SymbolBadge from "$ui/components/SymbolBadge.svelte";
</script>

<Stack direction="row" gap="sm" align="center">
  <SymbolBadge letter="C" tone="type" title="Class" />
  <SymbolBadge letter="I" tone="interface" title="Interface" />
  <SymbolBadge letter="F" tone="function" title="Function" />
  <SymbolBadge letter="M" tone="function" title="Method" />
  <SymbolBadge letter="K" tone="constant" title="Constant" />
</Stack>
