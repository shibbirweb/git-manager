<script lang="ts">
  import Button from "$ui/components/Button.svelte";
  import Card from "$ui/components/Card.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
</script>

<EmptyState icon="stash" title="No stashes" hint="Stash changes to set them aside for later.">
  {#snippet action()}<Button size="small">Stash Changes</Button>{/snippet}
</EmptyState>
<EmptyState title="Loading diff..." delayed />
<Card label="Panel">
  <EmptyState variant="panel" icon="bot" title="No folder open" hint="Open a folder to start AI agents in it.">
    {#snippet action()}<Button size="small">Open Folder...</Button>{/snippet}
  </EmptyState>
</Card>
<EmptyState variant="notice" title="No AI agents found" hint="Install an agent, then press Refresh.">
  {#snippet action()}<Button size="small">AI Settings...</Button>{/snippet}
</EmptyState>
<EmptyState
  icon="check"
  iconStyle="circle"
  iconTone="success"
  strong
  title="All committed"
  hint="Nothing to commit."
/>
<EmptyState
  icon="folder-git"
  iconTone="faint"
  strong
  title="No git repository"
  hint="Open a folder with a repository, or clone one."
/>
