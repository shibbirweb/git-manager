<!-- Main area when no diff, file or Log is open: the Navigation Bar on top, then ways to start. -->
<script lang="ts">
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import Logo from "@nibtree/ui/components/Logo.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import Toolbar from "@nibtree/ui/components/Toolbar.svelte";
  import type { IconName } from "@nibtree/ui/icons";
  import { commandKeys, currentPlatform } from "$lib/commands/commandRuntime";
  import NavigationBar from "$lib/navBar/NavigationBar.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { openFileSearch, openNavigationBar, openQuickOpen } from "./workspaceActions";

  /** Jump to Navigation Bar lands here while the group showing this screen is focused. */
  const claimed = $derived(repoStore.focusedGroupId === repoStore.primaryGroupId);

  interface StartAction {
    icon: IconName;
    label: string;
    /** The real keys on this platform, custom ones included; null for none. */
    keys: string | null;
    disabled?: boolean;
    run: () => void;
  }

  const actions = $derived<StartAction[]>([
    {
      icon: "git-compare",
      label: "Review changes",
      keys: commandKeys("view.changes"),
      run: () => settings.setLeftPanel("changes"),
    },
    {
      icon: "history",
      label: "Show the Log",
      keys: commandKeys("view.log"),
      disabled: !repoStore.repo,
      run: () => changesSelection.toggleLog(),
    },
    {
      icon: "list-tree",
      label: "Open a file from the Files panel",
      keys: null,
      run: () => {
        if (!settings.filesPanelShown) {
          settings.showRightPanel("files");
        }
      },
    },
    { icon: "file", label: "Go to File", keys: commandKeys("edit.goToFile"), run: () => openQuickOpen("") },
    {
      icon: "search",
      label: "Search Everywhere",
      keys: currentPlatform() === "macos" ? "⇧ ⇧" : "Shift Shift",
      run: () => openFileSearch("everywhere"),
    },
    {
      icon: "chevrons-right",
      label: "Navigation Bar",
      keys: commandKeys("edit.navigationBar"),
      run: openNavigationBar,
    },
  ]);
</script>

{#snippet navBar(placement: "top" | "bottom")}
  <Toolbar variant="file" {placement} label="Navigation Bar">
    <NavigationBar targetPath={repoStore.repo?.root ?? null} targetIsDir {claimed} />
  </Toolbar>
{/snippet}

<Stack gap="none" grow surface="editor">
  {#if settings.fileToolbarBreadcrumbs && settings.fileToolbar === "top"}
    {@render navBar("top")}
  {/if}
  <Stack grow align="center" justify="center" gap="mdPlus" padding="xl" label="Start">
    <Logo size="soft" />
    <Text variant="title">{repoStore.workspace?.name ?? "Nibtree"}</Text>
    <Stack gap="xs">
      {#each actions as action (action.label)}
        <Row size="entry" disabled={action.disabled} onclick={action.run}>
          <Icon name={action.icon} size="regular" tone="dim" />
          <Stack grow><Text tone="dim">{action.label}</Text></Stack>
          {#if action.keys}
            <Text size="small" tone="faint">{action.keys}</Text>
          {/if}
        </Row>
      {/each}
    </Stack>
  </Stack>
  {#if settings.fileToolbarBreadcrumbs && settings.fileToolbar === "bottom"}
    {@render navBar("bottom")}
  {/if}
</Stack>
