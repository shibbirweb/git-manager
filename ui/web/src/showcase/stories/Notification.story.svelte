<script lang="ts">
  import Notification from "$ui/components/Notification.svelte";
  import Stack from "$ui/components/Stack.svelte";

  const now = Date.now();
</script>

<Stack gap="lg">
  <Notification kind="success" title="Pushed" source="kb_dashboard" ondismiss={() => undefined} />
  <Notification
    kind="error"
    title="Push failed"
    detail={"! [rejected] main -> main (fetch first)\nhint: Updates were rejected because the remote contains work."}
    source="kpd_vuetify2"
    ondismiss={() => undefined}
  />
  <Notification
    kind="success"
    title="Discarded 3 lines"
    actionLabel="Undo"
    onaction={() => undefined}
    ondismiss={() => undefined}
  />
  <Stack gap="none">
    <Notification variant="row" kind="info" title="Fetched all remotes" time={now - 60_000} unread />
    <Stack line="top">
      <Notification variant="row" kind="warning" title="Pull stopped with conflicts" time={now - 3_600_000} />
    </Stack>
  </Stack>
</Stack>
