<script lang="ts">
  import Input from "$ui/components/Input.svelte";
  import Tabs from "$ui/components/Tabs.svelte";
  import Text from "$ui/components/Text.svelte";
  import ToggleButton from "$ui/components/ToggleButton.svelte";

  let tab = $state<"terminal" | "run" | "console">("terminal");
  let query = $state("");
  let editedOnly = $state(false);
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
<Text tone="dim">keepFocus: type in the field, then press a tab or the toggle; the field keeps the focus.</Text>
<Input bind:value={query} placeholder="Search everywhere" aria-label="Search everywhere" />
<ToggleButton label="Edited only" text="Edited only" variant="chip" bind:pressed={editedOnly} keepFocus />
<Tabs
  label="Search scope"
  variant="underline"
  keepFocus
  bind:value={tab}
  tabs={[
    { value: "terminal", label: "All" },
    { value: "run", label: "Files" },
    { value: "console", label: "Symbols" },
  ]}
/>
<Text tone="dim">Showing: {tab}</Text>
