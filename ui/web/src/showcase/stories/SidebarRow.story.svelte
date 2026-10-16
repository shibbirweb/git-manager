<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import SidebarRow from "$ui/components/SidebarRow.svelte";
  import Stack from "$ui/components/Stack.svelte";

  let open = $state(true);
  let selected = $state("main");
</script>

<Stack gap="none">
  <SidebarRow label="Local" section expanded={open} ontoggle={() => (open = !open)} count={3} />
  {#if open}
    <SidebarRow
      label="main"
      depth="one"
      icon="branch"
      current
      strong
      ahead={2}
      behind={1}
      selected={selected === "main"}
      onclick={() => (selected = "main")}
    />
    <SidebarRow
      label="feature/login"
      depth="one"
      icon="branch"
      selected={selected === "login"}
      onclick={() => (selected = "login")}
    >
      {#snippet actions()}<IconButton icon="trash" label="Delete" size="small" iconSize="compact" />{/snippet}
    </SidebarRow>
    <SidebarRow label="old/work" depth="one" icon="branch" gone detail="gone" />
  {/if}
</Stack>
