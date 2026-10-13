<!-- The library side of the row parity cases (cases/rows.ts). -->
<script lang="ts">
  import Fieldset from "$ui/components/Fieldset.svelte";
  import RadioGroup from "$ui/components/RadioGroup.svelte";
  import SidebarRow from "$ui/components/SidebarRow.svelte";

  let { id }: { id: string } = $props();
  let mode = $state("merge");
</script>

{#if id === "sidebar-row"}
  <div role="tree" aria-label="Branches">
    <SidebarRow label="Local" section expanded count={3} />
    <SidebarRow label="main" depth="one" icon="check" current strong selected ahead={2} />
  </div>
{/if}
