<script lang="ts">
  import StatusBar from "$ui/components/StatusBar.svelte";
  import Badge from "$ui/components/Badge.svelte";
  import Mark from "$ui/components/Mark.svelte";
  import Meter from "$ui/components/Meter.svelte";
  import StatusDot from "$ui/components/StatusDot.svelte";
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
    <StatusItem text="34%" title="AI usage" onclick={() => undefined}>
      {#snippet leading()}
        <Mark text="CC" size="small" />
        <Meter variant="mini" fraction={0.34} label="34% used" />
      {/snippet}
    </StatusItem>
    <StatusItem icon="coffee" text="While agents run" onclick={() => undefined}>
      {#snippet trailing()}<StatusDot size="small" tone="success" />{/snippet}
    </StatusItem>
    <StatusItem icon="bell" label="Notifications" onclick={() => undefined}>
      {#snippet trailing()}<Badge count={3} size="small" tone="warning" label="3 unread" />{/snippet}
    </StatusItem>
  {/snippet}
</StatusBar>
