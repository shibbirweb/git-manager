<script lang="ts">
  import StatusBar from "$ui/components/StatusBar.svelte";
  import StatusItem from "$ui/components/StatusItem.svelte";

  let open = $state(false);
</script>

<StatusBar>
  {#snippet start()}
    <StatusItem icon="folder-git" text="storefront" onclick={() => undefined} />
    <StatusItem icon="branch" text="main" onclick={() => undefined} />
    <StatusItem icon="sync" text="2↓ 1↑" title="Synchronize Changes" onclick={() => undefined} />
    <StatusItem text="3 changes" />
  {/snippet}
  {#snippet end()}
    <StatusItem icon="alert" text="1 conflict" tone="danger" onclick={() => undefined} />
    <StatusItem icon="memory" text="181 MB" {open} onclick={() => (open = !open)} />
    <StatusItem icon="bell" label="Notifications" onclick={() => undefined} />
  {/snippet}
</StatusBar>
<StatusBar look="rounded" label="Status bar, rounded">
  {#snippet start()}
    <StatusItem icon="folder-git" text="storefront" onclick={() => undefined} />
    <StatusItem icon="branch" text="main" onclick={() => undefined} />
  {/snippet}
  {#snippet end()}
    <StatusItem icon="memory" text="181 MB" onclick={() => undefined} />
  {/snippet}
</StatusBar>
