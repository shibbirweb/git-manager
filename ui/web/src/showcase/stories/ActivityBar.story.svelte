<script lang="ts">
  import ActivityBar from "$ui/components/ActivityBar.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let active = $state<string | null>("changes");
  let terminalOpen = $state(true);
</script>

<Stack direction="row" align="stretch" gap="lg">
  <ActivityBar
    label="Side panels"
    bind:active
    onselect={(id) => id === "terminal" && (terminalOpen = !terminalOpen)}
    items={[
      { id: "files", icon: "file", label: "Files" },
      {
        id: "changes",
        icon: "git-compare",
        label: "Changes",
        badge: 4,
        badgeTone: "danger",
        title: "Changes and its shortcut",
      },
      "divider",
      { id: "log", icon: "history", label: "Log" },
      null,
      { id: "terminal", icon: "terminal", label: "Terminal", active: terminalOpen },
      { id: "ai", icon: "bot", label: "AI", dot: true },
      { id: "settings", icon: "settings", label: "Settings" },
    ]}
  />
  <Text tone="dim">Open panel: {active}; the terminal toggles on its own ({terminalOpen ? "on" : "off"}).</Text>
</Stack>
