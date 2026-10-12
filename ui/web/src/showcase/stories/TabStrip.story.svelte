<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import TabStrip from "$ui/components/TabStrip.svelte";
  import Text from "$ui/components/Text.svelte";
  import { movedItems } from "$ui/logic/reorder";

  let tabs = $state([
    { id: "cart", label: "cart.ts", icon: "file" as const, dirty: true },
    { id: "readme", label: "README.md", icon: "file" as const, preview: true },
    { id: "diff", label: "app.css", icon: "git-compare" as const, hint: "Working Tree" },
    { id: "log", label: "Log", icon: "history" as const, pinned: true },
  ]);
  let active = $state<string | null>("cart");
  let focused = $state(true);
  let layout = $state<"scroll" | "wrap" | "single">("scroll");
</script>

<Stack gap="sm">
  <Segmented
    label="Layout"
    bind:value={layout}
    options={[
      { value: "scroll", label: "Scroll" },
      { value: "wrap", label: "Wrap" },
      { value: "single", label: "Single" },
    ]}
  />
  <TabStrip
    label="Editor tabs"
    tabs={layout === "single" ? tabs.slice(0, 1) : tabs}
    bind:active
    {focused}
    {layout}
    onclose={(id) => (tabs = tabs.filter((tab) => tab.id !== id))}
    onnew={() => undefined}
    onreorder={(from, to) => (tabs = movedItems(tabs, from, to))}
  />
  <Stack direction="row" align="center" gap="sm">
    <IconButton icon="eye" label="Toggle focus" active={!focused} onclick={() => (focused = !focused)} />
    <Text tone="dim">Active: {active}. Drag a tab to move it; toggle focus to see an unfocused group.</Text>
  </Stack>
</Stack>
