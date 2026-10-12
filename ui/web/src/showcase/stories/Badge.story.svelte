<script lang="ts">
  import Badge from "$ui/components/Badge.svelte";
  import Stack from "$ui/components/Stack.svelte";
</script>

<Stack direction="row" align="center" gap="lg">
  <Badge count={3} label="3 changes" />
  <Badge count={128} label="128 changes" />
  <Badge count={2} tone="danger" label="2 conflicts" />
  <Badge count={7} tone="neutral" />
</Stack>
<Stack direction="row" align="center" gap="lg">
  <Badge count={4} size="small" tone="warning" label="4 unread" />
  <Badge count={1} size="small" tone="danger" label="1 error" />
  <Badge count={12} size="large" tone="quiet" label="12 changes" />
</Stack>
