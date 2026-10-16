<script lang="ts">
  import AppShell from "$ui/components/AppShell.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Slider from "$ui/components/Slider.svelte";
  import SplitGrid from "$ui/components/SplitGrid.svelte";
  import Stack from "$ui/components/Stack.svelte";

  let look = $state<"flat" | "rounded">("flat");
  let ratio = $state(0.5);
  let focused = $state<string | null>("left");
  const groups = $derived([
    { id: "left", name: "cart.ts", rect: { x: 0, y: 0, width: ratio, height: 1 } },
    { id: "right", name: "tax.ts", rect: { x: ratio, y: 0, width: 1 - ratio, height: 1 } },
  ]);
  const splitters = $derived([
    { id: "split", direction: "right" as const, rect: { x: 0, y: 0, width: 1, height: 1 }, ratio },
  ]);
</script>

<Stack gap="md">
  <Slider
    label="Split"
    bind:value={ratio}
    min={0.15}
    max={0.85}
    step={0.05}
    format={(value) => `${Math.round(value * 100)}%`}
  />
  <Segmented
    label="Look"
    bind:value={look}
    options={[
      { value: "flat", label: "Flat" },
      { value: "rounded", label: "Rounded" },
    ]}
  />
  <AppShell height="small" {look}>
    {#snippet editor()}
      <SplitGrid {groups} {splitters} {look} {focused} onfocus={(id) => (focused = id)}>
        {#snippet group(entry)}<EmptyState title={entry.name} hint="An editor group" />{/snippet}
      </SplitGrid>
    {/snippet}
  </AppShell>
</Stack>
