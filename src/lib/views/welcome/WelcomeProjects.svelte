<!-- Welcome > Projects: the recent projects as one searchable list, or a first-run greeting with Open and Clone. -->
<script lang="ts">
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { tick } from "svelte";
  import { platformFromUserAgent } from "$lib/menu/menuSpec";
  import { settings } from "$lib/stores/settings.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { platformName } from "$lib/update/releases";
  import Avatar from "@nibtree/ui/components/Avatar.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Link from "@nibtree/ui/components/Link.svelte";
  import Logo from "@nibtree/ui/components/Logo.svelte";
  import Notice from "@nibtree/ui/components/Notice.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import SearchField from "@nibtree/ui/components/SearchField.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import Tile from "@nibtree/ui/components/Tile.svelte";
  import { revealLabel } from "../files/reveal";
  import { openCloneDialog } from "../git/gitMenuActions";
  import { type RecentEntry, recentEntries } from "../recentEntries";
  import {
    openRecent,
    openRecentInNewWindow,
    pickAndOpenInNewWindow,
    pickAndOpenRepo,
    pickAndOpenWorkspaceFile,
  } from "../repoPicker";
  import {
    badgeColor,
    entryKey,
    entryPaths,
    entrySubtitle,
    filterEntries,
    moveSelection,
    projectInitials,
  } from "../welcomeModel";

  const newWindowKey = platformFromUserAgent(navigator.userAgent) === "macos" ? "Cmd" : "Ctrl";
  const REVEAL_LABEL = revealLabel(platformName(navigator.userAgent));

  let query = $state("");
  let selected = $state(0);

  const entries = $derived(
    recentEntries(
      {
        recentWorkspaceFiles: settings.recentWorkspaceFiles,
        recentWorkspaces: settings.recentWorkspaces,
        recentRepos: settings.recentRepos,
      },
      null,
    ),
  );
  const shown = $derived(filterEntries(entries, query));
  const empty = $derived(entries.length === 0 && !settings.stateLoadError);

  // A new search starts at the top; a shorter list keeps the selection inside it.
  $effect(() => {
    void query;
    selected = 0;
  });
  $effect(() => {
    if (selected >= shown.length) {
      selected = Math.max(0, shown.length - 1);
    }
  });

  function rowId(index: number): string {
    return `welcome-project-${index}`;
  }

  function open(entry: RecentEntry, newWindow: boolean): void {
    void (newWindow ? openRecentInNewWindow(entry) : openRecent(entry));
  }

  function remove(entry: RecentEntry): void {
    if (entry.kind === "workspaceFile") {
      settings.removeRecentWorkspaceFile(entry.filePath);
    } else if (entry.kind === "workspace") {
      settings.removeRecentWorkspace(entry.folderPaths);
    } else {
      settings.removeRecent(entry.folderPath);
    }
  }

  function copyPaths(entry: RecentEntry): void {
    navigator.clipboard
      .writeText(entryPaths(entry).join("\n"))
      .then(() => toast.success("Path copied"))
      .catch(() => toast.error("Could not copy the path"));
  }

  function entryItems(entry: RecentEntry): MenuItem[] {
    const paths = entryPaths(entry);
    return [
      { label: "Open", action: () => open(entry, false) },
      { label: "Open in New Window", action: () => open(entry, true) },
      { separator: true },
      ...(paths.length === 1
        ? [
            {
              label: REVEAL_LABEL,
              action: () => void revealItemInDir(paths[0]).catch(() => toast.error("Could not show it")),
            },
          ]
        : []),
      { label: paths.length === 1 ? "Copy Path" : "Copy Paths", action: () => copyPaths(entry) },
      { separator: true },
      { label: "Remove from Recent Projects", action: () => remove(entry) },
    ];
  }

  function moreItems(): MenuItem[] {
    return [
      { label: "Open Workspace from File...", action: () => void pickAndOpenWorkspaceFile() },
      { label: "Open Folder in New Window...", action: () => void pickAndOpenInNewWindow() },
    ];
  }

  async function revealSelected(): Promise<void> {
    await tick();
    document.getElementById(rowId(selected))?.scrollIntoView({ block: "nearest" });
  }

  /** The search field keeps the keyboard: arrows pick a project, Enter opens it, Delete forgets it. */
  function onSearchKeydown(event: KeyboardEvent): void {
    const next = moveSelection(selected, event.key, shown.length);
    if (next !== null && (event.key.startsWith("Arrow") || query === "")) {
      event.preventDefault();
      selected = next;
      void revealSelected();
      return;
    }
    const entry = shown[selected];
    if (event.key === "Enter" && entry) {
      event.preventDefault();
      open(entry, event.metaKey || event.ctrlKey);
    } else if ((event.key === "Delete" || (event.key === "Backspace" && event.metaKey)) && query === "" && entry) {
      event.preventDefault();
      remove(entry);
    }
  }
</script>

{#if empty}
  <Stack grow align="center" justify="center" gap="lg" padding="xxxl">
    <Logo size="large" />
    <Text element="h1" variant="display">Welcome to Nibtree</Text>
    <Stack align="center" gap="xxs">
      <Text tone="dim">Open a folder with one repository, many repositories, or none yet.</Text>
      <Text tone="dim">Or clone one from a server.</Text>
    </Stack>
    <Stack direction="row" gap="xxxl" paddingY="xl">
      <Tile icon="folder" label="Open" onclick={pickAndOpenRepo} />
      <Tile icon="cloud-download" label="Clone Repository" onclick={openCloneDialog} />
      <Tile icon="folder-git" label="Open Workspace" onclick={() => void pickAndOpenWorkspaceFile()} />
    </Stack>
  </Stack>
{:else}
  <Stack grow gap="lg" paddingX="xxl" paddingY="xxl">
    <Stack direction="row" align="center" gap="mdPlus">
      <Stack grow>
        <SearchField
          size="large"
          bind:value={query}
          placeholder="Search projects"
          label="Search projects"
          autofocus
          onkeydown={onSearchKeydown}
        />
      </Stack>
      <Button title="Open Folder..." onclick={pickAndOpenRepo}>Open</Button>
      <Button title="Clone Repository..." onclick={openCloneDialog}>Clone</Button>
      <IconButton
        icon="more"
        size="large"
        iconSize="regular"
        label="More actions"
        onclick={(event) => contextMenu.open(event, moreItems())}
      />
    </Stack>

    {#if settings.stateLoadError}
      <Notice tone="warning">
        Recent projects could not be loaded because state.json could not be read.
        <Link onclick={() => settings.openDialog("files")}>Open Settings</Link>
      </Notice>
    {/if}

    <Stack element="ul" grow scroll="y" gap="none" label="Recent projects">
      {#each shown as entry, index (entryKey(entry))}
        <Stack element="li">
          <Row
            size="large"
            cursor="pointer"
            id={rowId(index)}
            selected={index === selected}
            actionsShown={index === selected ? "always" : "hover"}
            title="{newWindowKey}+click to open in a new window"
            onclick={(event) => open(entry, event.metaKey || event.ctrlKey)}
            onhover={() => (selected = index)}
            oncontextmenu={(event) => contextMenu.open(event, entryItems(entry))}
          >
            <Avatar shape="tile" text={projectInitials(entry.label)} color={badgeColor(entryKey(entry))} />
            <Stack grow gap="xxs">
              <Text weight="semibold" truncate>{entry.label}</Text>
              <Text size="small" tone="dim" truncate>{entrySubtitle(entry)}</Text>
            </Stack>
            {#snippet actions()}
              <IconButton
                icon="more"
                size="large"
                iconSize="large"
                label="Actions for {entry.label}"
                title="Project actions"
                onclick={(event) => contextMenu.open(event, entryItems(entry))}
              />
            {/snippet}
          </Row>
        </Stack>
      {:else}
        {#if query}
          <Stack element="li" paddingX="lg" paddingY="xl">
            <Text tone="dim">No recent project matches "{query}".</Text>
          </Stack>
        {/if}
      {/each}
    </Stack>
  </Stack>
{/if}
