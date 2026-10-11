<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import TabStrip from "$ui/components/TabStrip.svelte";
  import Text from "$ui/components/Text.svelte";

  let tabs = $state([
    { id: "cart", label: "cart.ts", icon: "file" as const, dirty: true },
    { id: "readme", label: "README.md", icon: "file" as const, preview: true },
    { id: "diff", label: "app.css", icon: "git-compare" as const, hint: "Working Tree" },
    { id: "log", label: "Log", icon: "history" as const, pinned: true },
  ]);
  let active = $state<string | null>("cart");
  let focused = $state(true);
</script>

<Stack gap="sm">
  <TabStrip
    label="Editor tabs"
    {tabs}
    bind:active
    {focused}
    onclose={(id) => (tabs = tabs.filter((tab) => tab.id !== id))}
  >
    {#snippet trailing()}<IconButton icon="plus" label="New tab" size="small" />{/snippet}
  </TabStrip>
  <Stack direction="row" align="center" gap="sm">
    <IconButton icon="eye" label="Toggle focus" active={!focused} onclick={() => (focused = !focused)} />
    <Text tone="dim">Active: {active}. Toggle focus to see an unfocused group.</Text>
  </Stack>
</Stack>
