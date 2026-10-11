<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
</script>

<EmptyState icon="stash" title="No stashes" hint="Stash changes to set them aside for later.">
  {#snippet action()}<Button size="small">Stash Changes</Button>{/snippet}
</EmptyState>
