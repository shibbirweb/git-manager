<!-- Activity bar: picks what the left sidebar shows, or hides it. -->
<script lang="ts">
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import type { CommandId } from "$lib/commands/registry";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { type LeftPanel, settings } from "$lib/stores/settings.svelte";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import ActivityBar from "@git-manager/ui/components/ActivityBar.svelte";
  import type { IconName } from "@git-manager/ui/icons";
  import { changesSelection } from "./changes/selection.svelte";

  interface Item {
    panel: Exclude<LeftPanel, null>;
    icon: IconName;
    label: string;
    /** The command whose keys the tooltip shows. */
    commandId: CommandId;
  }

  const items: Item[] = [
    { panel: "changes", icon: "git-compare", label: "Changes", commandId: "view.changes" },
    { panel: "branches", icon: "branch", label: "Branches and Stashes", commandId: "view.branches" },
  ];

  const conflicts = $derived(
    Object.values(repoStore.statuses).reduce(
      (sum, status) => sum + status.files.filter((file) => file.conflicted).length,
      0,
    ),
  );

  /** The tooltip: the name with its keys, and how to hide it while it is on. */
  function tip(text: string, on: boolean): string {
    return `${text}${on ? ", click to hide" : ""}`;
  }

  const bar = $derived([
    ...items.map((item) => ({
      id: item.panel,
      icon: item.icon,
      label: item.label,
      active: settings.leftPanel === item.panel,
      title: tip(withCommandKeys(item.label, item.commandId), settings.leftPanel === item.panel),
      badge: item.panel === "changes" ? repoStore.totalChanges : undefined,
      badgeTone: conflicts > 0 ? ("danger" as const) : ("accent" as const),
    })),
    "divider" as const,
    // The Log opens in the main area rather than in the sidebar.
    {
      id: "log",
      icon: "history" as const,
      label: "Log",
      active: changesSelection.logShown,
      title: tip(withCommandKeys("Log: commit history and graph", "view.log"), changesSelection.logShown),
    },
    null,
    // Scripts of package.json, composer.json, Makefiles and the like, run in a terminal.
    {
      id: "scripts",
      icon: "play" as const,
      label: "Scripts",
      smallIcon: true,
      active: settings.leftPanel === "scripts",
      title:
        settings.leftPanel === "scripts"
          ? "Scripts, click to hide"
          : "Scripts: run npm, Composer, Make and other project scripts",
    },
    // The terminal panel opens below the editor.
    {
      id: "terminal",
      icon: "terminal" as const,
      label: "Terminal",
      active: terminalStore.panelOpen,
      title: tip(withCommandKeys("Terminal", "view.terminal"), terminalStore.panelOpen),
    },
  ]);

  function select(id: string): void {
    if (id === "log") {
      changesSelection.toggleLog();
    } else if (id === "terminal") {
      terminalStore.toggle();
    } else {
      settings.toggleLeftPanel(id as Exclude<LeftPanel, null>);
    }
  }
</script>

<ActivityBar label="Sidebar" items={bar} onselect={select} />
