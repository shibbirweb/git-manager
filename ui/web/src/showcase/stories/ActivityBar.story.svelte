<script lang="ts">
  import ActivityBar from "$ui/components/ActivityBar.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let active = $state<string | null>("changes");
</script>

<Stack direction="row" align="stretch" gap="lg">
  <ActivityBar
    label="Side panels"
    bind:active
    items={[
      { id: "files", icon: "file", label: "Files" },
      { id: "changes", icon: "git-compare", label: "Changes", badge: 4 },
      { id: "log", icon: "history", label: "Log" },
      null,
      { id: "settings", icon: "settings", label: "Settings" },
    ]}
  />
  <Text tone="dim">Open panel: {active}</Text>
</Stack>
