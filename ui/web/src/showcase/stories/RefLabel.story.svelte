<script lang="ts">
  import RefLabel from "$ui/components/RefLabel.svelte";
  import Stack from "$ui/components/Stack.svelte";
</script>

<Stack direction="row" gap="xs" wrap>
  <RefLabel kind="head" label="main" />
  <RefLabel kind="local" label="feature/login" />
  <RefLabel kind="remote" label="origin/main" />
  <RefLabel kind="tag" label="v1.0.0" icon="tag" />
  <RefLabel kind="bisect-bad" label="bad" />
  <RefLabel kind="bisect-good" label="good" />
  <RefLabel kind="more" label="+3" title="origin/dev, v0.9, v0.8" />
</Stack>
