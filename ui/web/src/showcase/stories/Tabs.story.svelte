<script lang="ts">
  import Tabs from "$ui/components/Tabs.svelte";
  import Text from "$ui/components/Text.svelte";

  let tab = $state<"terminal" | "run" | "console">("terminal");
</script>

<Tabs
  label="Panel views"
  bind:value={tab}
  tabs={[
    { value: "terminal", label: "Terminal" },
    { value: "run", label: "Run" },
    { value: "console", label: "Git Console" },
  ]}
/>
<Tabs
  label="Search scope"
  variant="underline"
  bind:value={tab}
  tabs={[
    { value: "terminal", label: "All" },
    { value: "run", label: "Files" },
    { value: "console", label: "Symbols" },
  ]}
/>
<Text tone="dim">Showing: {tab}</Text>
