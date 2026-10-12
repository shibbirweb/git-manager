<script lang="ts">
  import IconButton from "$ui/components/IconButton.svelte";
  import PanelHeader from "$ui/components/PanelHeader.svelte";
</script>

<PanelHeader title="Changes">
  {#snippet actions()}
    <IconButton icon="refresh" label="Refresh" size="compact" iconSize="medium" />
    <IconButton icon="more" label="More actions" size="compact" iconSize="medium" />
  {/snippet}
</PanelHeader>
