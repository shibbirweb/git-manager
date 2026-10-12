<script lang="ts">
  import CrumbPopup from "$ui/components/CrumbPopup.svelte";
  import Text from "$ui/components/Text.svelte";

  const all = [
    { id: "components", name: "components", icon: "folder" as const, folder: true },
    { id: "cart.ts", name: "cart.ts", icon: "file" as const, tone: "modified" as const },
    { id: "tax.ts", name: "tax.ts", icon: "file" as const, tone: "added" as const },
    { id: "old.ts", name: "old.ts", icon: "file" as const, tone: "conflict" as const },
  ];
  let query = $state("");
  let picked = $state("nothing yet");
  const entries = $derived(all.filter((entry) => entry.name.includes(query)));
</script>

<CrumbPopup
  label="src/lib"
  {entries}
  bind:query
  message={entries.length ? "" : "No matches"}
  onpick={(entry) => (picked = entry.name)}
/>
<Text tone="dim">Picked: {picked}</Text>
