<script lang="ts">
  import Menu from "$ui/components/Menu.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import Text from "$ui/components/Text.svelte";
  import type { MenuItem } from "$ui/logic/menuModel";

  let last = $state("nothing yet");
  let at = $state<{ x: number; y: number } | null>(null);

  const items: MenuItem[] = [
    { label: "Open", action: () => (last = "Open"), hint: "⌘↓" },
    { label: "Open to the Side", action: () => (last = "Open to the Side") },
    { separator: true },
    {
      label: "Copy",
      submenu: [
        { label: "Path", action: () => (last = "Copy Path") },
        { label: "Relative Path", action: () => (last = "Copy Relative Path") },
      ],
    },
    { label: "Rename...", action: () => (last = "Rename"), disabled: true },
    { separator: true },
    { label: "Delete", action: () => (last = "Delete"), danger: true },
  ];
</script>

<Stack gap="sm">
  <div
    role="button"
    tabindex="0"
    oncontextmenu={(event) => {
      event.preventDefault();
      at = { x: event.clientX, y: event.clientY };
    }}
  >
    <Text tone="dim">Right-click this line to open the menu.</Text>
  </div>
  <Text>Ran: {last}</Text>
</Stack>
{#if at}
  <Menu {items} x={at.x} y={at.y} label="File" onclose={() => (at = null)} />
{/if}
