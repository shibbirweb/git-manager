<!--
  The Shelf, in the bottom panel: the active repository's shelved change lists with their files.
  Double click (or Enter) on a file shows its diff; the right-click menus unshelve, rename and delete.
-->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import List from "@nibtree/ui/components/List.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import StatusLetter from "@nibtree/ui/components/StatusLetter.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import Toolbar from "@nibtree/ui/components/Toolbar.svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ShelfEntry, ShelvedFile } from "$lib/types";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import {
    deleteEntry,
    openShelveDialog,
    renameEntry,
    shelfState,
    showShelvedDiff,
    unshelveEntry,
  } from "./shelfActions.svelte";
  import {
    fileCountLabel,
    fileRowId,
    formatShelfDate,
    selectedPaths,
    shelfRows,
    shelveCandidates,
    shelvedFileLabel,
    type ShelfRow,
  } from "./shelfModel";

  const repoRoot = $derived(repoStore.repo?.root ?? null);
  const repoName = $derived(repoStore.repo?.name ?? "");
  const busy = $derived(repoStore.busy !== null);
  const changeCount = $derived(repoRoot ? shelveCandidates(repoStore.statuses[repoRoot]?.files ?? []).length : 0);

  let entries = $state.raw<ShelfEntry[]>([]);
  let loadError = $state<string | null>(null);
  let loaded = $state(false);
  let collapsed = $state.raw<Set<string>>(new Set());
  let selection = $state.raw<string[]>([]);
  let current = $state<string | null>(null);
  let loadToken = 0;

  const rows = $derived(shelfRows(entries, collapsed));

  $effect(() => {
    void shelfState.version;
    void load(repoRoot);
  });

  async function load(targetRoot: string | null): Promise<void> {
    const token = ++loadToken;
    if (!targetRoot) {
      entries = [];
      loaded = true;
      return;
    }
    try {
      const next = await api.listShelf(targetRoot);
      if (token === loadToken) {
        entries = next ?? [];
        loadError = null;
        loaded = true;
      }
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
        loaded = true;
      }
    }
  }

  function setCollapsed(shelfId: string, folded: boolean): void {
    const next = new Set(collapsed);
    if (folded) {
      next.add(shelfId);
    } else {
      next.delete(shelfId);
    }
    collapsed = next;
  }

  function entryMenu(event: MouseEvent, entry: ShelfEntry): void {
    if (!repoRoot) {
      return;
    }
    const root = repoRoot;
    const firstFile = entry.files[0];
    const items: MenuItem[] = [
      { label: "Unshelve...", disabled: busy, action: () => void unshelveEntry(root, entry) },
      {
        label: "Show Diff",
        disabled: !firstFile,
        action: () => (firstFile ? showShelvedDiff(root, entry.id, firstFile.path) : undefined),
      },
      { separator: true },
      { label: "Rename...", disabled: busy, action: () => void renameEntry(root, entry) },
      { label: "Delete...", danger: true, disabled: busy, action: () => void deleteEntry(root, entry) },
    ];
    contextMenu.open(event, items);
  }

  function fileMenu(event: MouseEvent, entry: ShelfEntry, file: ShelvedFile): void {
    if (!repoRoot) {
      return;
    }
    const root = repoRoot;
    const id = fileRowId(entry.id, file.path);
    if (!selection.includes(id)) {
      selection = [id];
    }
    const paths = selectedPaths(selection, entry);
    const items: MenuItem[] = [
      { label: "Show Diff", action: () => showShelvedDiff(root, entry.id, file.path) },
      { separator: true },
      {
        label: paths.length > 1 ? `Unshelve ${fileCountLabel(paths.length)}...` : "Unshelve Selected Files...",
        disabled: busy,
        action: () => void unshelveEntry(root, entry, paths),
      },
      { label: "Unshelve All...", disabled: busy, action: () => void unshelveEntry(root, entry) },
    ];
    contextMenu.open(event, items);
  }

  // Enter opens a file's diff or folds a change list; a click already folds it, so a double-click does not.
  function activate(row: ShelfRow, event?: unknown): void {
    if (row.kind === "file") {
      if (repoRoot) {
        showShelvedDiff(repoRoot, row.entry.id, row.file.path);
      }
    } else if (!(event instanceof MouseEvent)) {
      setCollapsed(row.entry.id, !collapsed.has(row.entry.id));
    }
  }

  function fileName(filePath: string): string {
    return filePath.slice(filePath.lastIndexOf("/") + 1);
  }

  function folderOf(filePath: string): string {
    const slash = filePath.lastIndexOf("/");
    return slash > 0 ? filePath.slice(0, slash) : "";
  }

  function entryTitle(entry: ShelfEntry): string {
    return `${entry.name}${entry.branch ? `\nFrom ${entry.branch}` : ""}\n${formatShelfDate(entry.createdAt)}`;
  }
</script>

<Stack gap="none" grow surface="editor">
  <Toolbar variant="panel" label="Shelf">
    <Text size="small" tone="dim" truncate title={repoRoot ?? ""}>{repoName}</Text>
    {#snippet end()}
      <Button
        size="small"
        disabled={!repoRoot || busy || changeCount === 0}
        title={changeCount === 0 ? "There are no changes to shelve" : "Shelve Changes..."}
        onclick={() => openShelveDialog(repoRoot)}
      >
        Shelve Changes...
      </Button>
      <IconButton
        icon="refresh"
        iconSize="normal"
        size="compact"
        tone="dim"
        label="Refresh"
        disabled={!repoRoot}
        onclick={() => void load(repoRoot)}
      />
    {/snippet}
  </Toolbar>
  {#if !repoRoot}
    <EmptyState title="Open a repository to see its shelf." titleTone="dim" />
  {:else if loadError}
    <EmptyState title="Could not read the shelf: {loadError}" titleTone="dim" />
  {:else if loaded && entries.length === 0}
    <EmptyState
      title="No shelved changes. Shelve Changes puts changes aside without committing them."
      titleTone="dim"
    />
  {:else}
    <List
      items={rows}
      itemKey={(row) => row.id}
      label="Shelved changes"
      role="tree"
      height="fill"
      multiple
      bind:selection
      bind:selected={current}
      level={(row) => (row.kind === "file" ? 1 : 0)}
      expanded={(row) => (row.kind === "entry" ? !collapsed.has(row.entry.id) : null)}
      ontoggle={(row, open) => setCollapsed(row.entry.id, !open)}
      onactivate={activate}
      oncontextmenu={(event, row) =>
        row.kind === "file" ? fileMenu(event, row.entry, row.file) : entryMenu(event, row.entry)}
    >
      {#snippet row(row, state)}
        {#if row.kind === "entry"}
          {@const entry = row.entry}
          <Row
            selected={state.selected}
            expanded={!collapsed.has(entry.id)}
            title={entryTitle(entry)}
            onclick={() => setCollapsed(entry.id, !collapsed.has(entry.id))}
          >
            <Icon name="stash" size="normal" />
            <Text truncate>{entry.name}</Text>
            <Text size="small" tone="dim">{fileCountLabel(entry.files.length)}</Text>
            <Text size="small" tone="dim">{formatShelfDate(entry.createdAt)}</Text>
            {#snippet actions()}
              <IconButton
                icon="arrow-up"
                iconSize="medium"
                size="inline"
                tone="dim"
                label="Unshelve {entry.name}"
                title="Unshelve..."
                disabled={busy}
                onclick={() => repoRoot && void unshelveEntry(repoRoot, entry)}
              />
              <IconButton
                icon="trash"
                iconSize="medium"
                size="inline"
                tone="dim-danger"
                label="Delete {entry.name}"
                title="Delete..."
                disabled={busy}
                onclick={() => repoRoot && void deleteEntry(repoRoot, entry)}
              />
            {/snippet}
          </Row>
        {:else}
          {@const file = row.file}
          <Row
            selected={state.selected}
            depth={1}
            expanded="leaf"
            title="{shelvedFileLabel(file)}{file.binary ? ' (binary)' : ''}"
          >
            <StatusLetter kind={file.change} />
            <Text truncate>{fileName(file.path)}</Text>
            <Text size="small" tone="dim" truncate giveWay>{folderOf(file.path)}</Text>
          </Row>
        {/if}
      {/snippet}
    </List>
  {/if}
</Stack>
