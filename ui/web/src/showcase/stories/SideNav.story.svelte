<script lang="ts">
  import SideNav from "$ui/components/SideNav.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";

  let active = $state<string | null>("editor");
</script>

<Stack direction="row" gap="xl">
  <SideNav
    label="Settings sections"
    bind:active
    items={[
      { id: "appearance", label: "Appearance" },
      { id: "editor", label: "Editor" },
      { id: "git", label: "Git" },
      { id: "reset", label: "Reset All Settings...", danger: true },
    ]}
  />
  <Stack gap="lg">
    <SideNav
      label="Welcome sections"
      variant="large"
      bind:active
      items={[
        { id: "projects", label: "Projects" },
        { id: "customize", label: "Customize" },
        { id: "learn", label: "Learn" },
      ]}
    />
    <SideNav
      label="Links"
      variant="links"
      items={[
        { id: "docs", label: "Documentation", icon: "book" },
        { id: "keys", label: "Keyboard Shortcuts", icon: "keyboard" },
      ]}
    />
  </Stack>
  <Text tone="dim">Open: {active}</Text>
</Stack>
