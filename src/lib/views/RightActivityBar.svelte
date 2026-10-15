<!-- Activity bar on the right edge, mirroring the left one: shows the Files or the AI panel in the right sidebar. -->
<script lang="ts">
  import ActivityBar from "@git-manager/ui/components/ActivityBar.svelte";
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import { settings } from "$lib/stores/settings.svelte";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";

  // A hidden agent that finished or needs the user marks the AI icon too, while the panel is not shown.
  const agentBell = $derived(
    !settings.aiPanelShown && terminalStore.terminals.some((terminal) => terminal.agent && terminal.bell),
  );

  const items = $derived([
    {
      id: "files",
      icon: "list-tree" as const,
      label: "Files",
      active: settings.filesPanelShown,
      title: `${withCommandKeys("Files", "view.filesPanel")}${settings.filesPanelShown ? ", click to hide" : ""}`,
    },
    {
      id: "ai",
      icon: "bot" as const,
      label: "AI Agents",
      active: settings.aiPanelShown,
      dot: agentBell,
      title: `${withCommandKeys("AI Agents", "view.aiPanel")}${settings.aiPanelShown ? ", click to hide" : ""}`,
    },
  ]);

  function select(id: string): void {
    if (id === "files") {
      settings.toggleExplorer();
    } else {
      settings.toggleRightPanel("ai");
    }
  }
</script>

<ActivityBar label="Right sidebar" side="right" {items} onselect={select} />
