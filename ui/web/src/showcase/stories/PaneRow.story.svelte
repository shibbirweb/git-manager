<script lang="ts">
  import AppShell from "$ui/components/AppShell.svelte";
  import EmptyState from "$ui/components/EmptyState.svelte";
  import PaneRow from "$ui/components/PaneRow.svelte";

  const panes = [
    { key: "zsh", share: 1 },
    { key: "build", share: 1 },
    { key: "agent", share: 2 },
  ];
  let focused = $state<string | null>("build");
</script>

<AppShell height="small">
  {#snippet editor()}
    <PaneRow {panes} {focused}>
      {#snippet pane(entry)}<EmptyState title={entry.key} hint="A terminal" />{/snippet}
    </PaneRow>
  {/snippet}
</AppShell>
