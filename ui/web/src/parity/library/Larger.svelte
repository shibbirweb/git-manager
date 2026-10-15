<!-- The library side of the larger parity cases (cases/larger.ts). -->
<script lang="ts">
  import CommandPalette from "$ui/components/CommandPalette.svelte";
  import DataTable from "$ui/components/DataTable.svelte";
  import ReorderList from "$ui/components/ReorderList.svelte";
  import ShortcutRecorder from "$ui/components/ShortcutRecorder.svelte";
  import Text from "$ui/components/Text.svelte";

  let { id }: { id: string } = $props();
  const run = () => undefined;
  const commit = { id: "a1b2c3d", subject: "Round tax", author: "Ada", date: "1 Oct" };
</script>

{#if id === "command-palette"}
  <CommandPalette
    label="Go to File"
    placeholder="File name"
    status="2 files"
    onpick={run}
    items={[
      { id: "cart", title: "cart.ts" },
      { id: "tax", title: "tax.ts" },
    ]}
  />
{/if}
