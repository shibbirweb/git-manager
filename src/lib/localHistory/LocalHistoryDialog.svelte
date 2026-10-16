<!-- Local History window: a file's kept versions on the left, the selected one
     against the current text on the right, with Revert, Restore and Copy. Recently Deleted lists
     files that are gone from disk but still have versions. Loaded only while open. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import GitDiffView from "$lib/diff/GitDiffView.svelte";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { fileCommands } from "$lib/stores/fileCommands.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { baseName, folderFor, parentOf, relativeTo } from "$lib/stores/workspacePaths";
  import type { DeletedLocalFile, FileDiff, FileLocalHistory } from "$lib/types";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Dialog from "@git-manager/ui/components/Dialog.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import List from "@git-manager/ui/components/List.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import SectionTitle from "@git-manager/ui/components/SectionTitle.svelte";
  import SplitPane from "@git-manager/ui/components/SplitPane.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { localHistory } from "./localHistory.svelte";
  import {
    isSafetyCopy,
    snapshotLabel,
    snapshotTitle,
    timeText,
    versionHash,
    versionKey,
    versionRows,
  } from "./localHistoryModel";

  const target = $derived(localHistory.target);
  const filePath = $derived(target?.kind === "file" ? target.filePath : null);

  let history = $state.raw<FileLocalHistory | null>(null);
  let deleted = $state.raw<DeletedLocalFile[] | null>(null);
  let loadError = $state<string | null>(null);
  let selectedHash = $state<string | null>(null);
  let diff = $state.raw<FileDiff | null>(null);
  let diffError = $state<string | null>(null);
  let working = $state(false);
  let listWidth = $state(240);
  let loadToken = 0;
  let diffToken = 0;

  const snapshots = $derived(history?.snapshots ?? []);
  const selectedIndex = $derived(snapshots.findIndex((snapshot) => snapshot.hash === selectedHash));
  const selected = $derived(selectedIndex >= 0 ? snapshots[selectedIndex] : null);
  const rows = $derived(versionRows(snapshots, Date.now()));
  const selectedKey = $derived(selected ? versionKey(selected) : null);
  const dirty = $derived(filePath !== null && repoStore.isDirty(filePath));
  const textual = $derived(diff !== null && !diff.binary && !diff.tooLarge);
  const folders = $derived(repoStore.workspace?.folders ?? []);

  function displayPath(absolute: string): string {
    const folder = folderFor(folders, absolute);
    return folder ? `${folder.name}/${relativeTo(folder.root, absolute)}` : absolute;
  }

  // A file's versions, read again after Clear Local History.
  $effect(() => {
    const shownPath = filePath;
    void localHistory.version;
    if (shownPath) {
      void loadHistory(shownPath, true);
    }
  });

  // Recently Deleted.
  $effect(() => {
    const current = target;
    void localHistory.version;
    if (current?.kind === "deleted") {
      void loadDeleted(current.folderPaths);
    }
  });

  $effect(() => {
    const shownPath = filePath;
    const shownHash = selectedHash;
    if (shownPath && shownHash) {
      void loadDiff(shownPath, shownHash);
    } else {
      diff = null;
      diffError = null;
    }
  });

  async function loadHistory(historyPath: string, selectFirst: boolean): Promise<void> {
    const token = ++loadToken;
    try {
      const next = await api.localHistoryList(historyPath);
      if (token !== loadToken) {
        return;
      }
      history = next;
      loadError = null;
      if (selectFirst || !next.snapshots.some((snapshot) => snapshot.hash === selectedHash)) {
        selectedHash = next.snapshots[0]?.hash ?? null;
      }
    } catch (error) {
      if (token === loadToken) {
        history = null;
        loadError = errorMessage(error);
      }
    }
  }

  async function loadDeleted(folderPaths: string[]): Promise<void> {
    const token = ++loadToken;
    history = null;
    selectedHash = null;
    try {
      const next = await api.localHistoryDeleted(folderPaths);
      if (token === loadToken) {
        deleted = next;
        loadError = null;
      }
    } catch (error) {
      if (token === loadToken) {
        deleted = null;
        loadError = errorMessage(error);
      }
    }
  }

  async function loadDiff(historyPath: string, snapshotHash: string): Promise<void> {
    const token = ++diffToken;
    // Unsaved edits are part of "now"; otherwise the backend reads the file.
    const currentText = repoStore.isDirty(historyPath) ? fileCommands.text(historyPath) : null;
    try {
      const next = await api.localHistoryDiff(historyPath, snapshotHash, currentText);
      if (token === diffToken) {
        diff = next;
        diffError = null;
      }
    } catch (error) {
      if (token === diffToken) {
        diff = null;
        diffError = errorMessage(error);
      }
    }
  }

  async function revert(): Promise<void> {
    if (!filePath || !diff || !textual || working) {
      return;
    }
    working = true;
    const done = await localHistory.revert(filePath, diff.original);
    working = false;
    if (done) {
      localHistory.close();
    }
  }

  async function restore(): Promise<void> {
    if (!filePath || !selected || working) {
      return;
    }
    working = true;
    const done = await localHistory.restore(filePath, selected.hash);
    working = false;
    if (done) {
      await loadHistory(filePath, false);
    }
  }

  const rightLabel = $derived(history && !history.exists ? "Deleted" : dirty ? "Current (unsaved)" : "Current");
  const leftLabel = $derived(selected ? `${snapshotLabel(selected.label)}, ${timeText(selected.time)}` : "Version");
</script>

{#snippet back()}
  {#if target?.kind === "file" && target.fromDeleted}
    {@const from = target.fromDeleted}
    <Toolbar variant="dialog" label="Local History">
      <Button variant="ghost" size="small" icon="arrow-left" onclick={() => localHistory.openDeleted(from)}>
        Recently Deleted
      </Button>
    </Toolbar>
  {/if}
{/snippet}

{#snippet versions()}
  <Stack grow surface="alt" gap="none">
    <List
      items={rows}
      itemKey={(row) => row.key}
      label="Versions"
      height="fill"
      skip={(row) => row.kind === "day"}
      bind:selected={() => selectedKey, (key) => (selectedHash = key ? versionHash(key) : null)}
    >
      {#snippet row(row, state)}
        {#if row.kind === "day"}
          <SectionTitle variant="day" title={row.title} />
        {:else}
          <Row selected={state.selected} align="baseline" title={snapshotTitle(row.snapshot)}>
            <Text mono size="compact" tabular>{timeText(row.snapshot.time)}</Text>
            <Text truncate tone={isSafetyCopy(row.snapshot.label) ? "warning" : "dim"}>
              {snapshotLabel(row.snapshot.label)}
            </Text>
          </Row>
        {/if}
      {/snippet}
    </List>
  </Stack>
{/snippet}

{#snippet compare(exists: boolean)}
  <Stack grow gap="none">
    <Toolbar variant="pane" label="Version actions">
      {#if exists}
        <Button size="small" variant="primary" disabled={!textual || working} onclick={() => void revert()}>
          Revert to This
        </Button>
      {:else}
        <Button size="small" variant="primary" disabled={!selected || working} onclick={() => void restore()}>
          Restore File
        </Button>
      {/if}
      <Button size="small" disabled={!textual} onclick={() => diff && void localHistory.copy(diff.original)}
        >Copy</Button
      >
      <Text size="small" tone="dim" truncate>
        {exists
          ? "Revert puts this version in the editor; Undo takes it back."
          : "The file is deleted. Restore writes this version back."}
      </Text>
    </Toolbar>
    {#if diffError}
      <EmptyState icon="alert" title={diffError} titleTone="dim" />
    {:else if diff && filePath}
      <GitDiffView
        source={{ kind: "plain" }}
        {diff}
        path={filePath}
        labels={{ left: leftLabel, right: rightLabel }}
        workingFile={exists ? { filePath, sameLines: true } : null}
      />
    {:else}
      <EmptyState title="Loading..." titleTone="dim" delayed />
    {/if}
  </Stack>
{/snippet}

<Dialog
  open
  variant="view"
  title={filePath ? `Local History: ${baseName(filePath)}` : "Recently Deleted"}
  subtitle={filePath ? displayPath(parentOf(filePath)) : "Files that are gone but still have versions in Local History"}
  icon="history"
  toolbar={target?.kind === "file" && target.fromDeleted ? back : undefined}
  onclose={() => localHistory.close()}
>
  {#if loadError}
    <EmptyState icon="alert" title="Could not read Local History" hint={loadError} />
  {:else if target?.kind === "deleted"}
    {@const folderPaths = target.folderPaths}
    {#if deleted === null}
      <EmptyState title="Loading..." titleTone="dim" delayed />
    {:else if deleted.length === 0}
      <EmptyState title="No deleted files with Local History" titleTone="dim" />
    {:else}
      <Stack grow scroll="y" gap="none" role="group" label="Deleted files">
        {#each deleted as item (item.filePath)}
          <Row size="entry" align="baseline" onclick={() => localHistory.openFile(item.filePath, folderPaths)}>
            <Icon name="file" size="medium" />
            <Text>{baseName(item.filePath)}</Text>
            <Text size="small" tone="dim" truncate title={item.filePath}>{displayPath(parentOf(item.filePath))}</Text>
            <Text size="small" tone="dim" title={fullDate(Math.floor(item.latest.time / 1000))}>
              {relativeTime(Math.floor(item.latest.time / 1000))}
            </Text>
            <Text size="small" tone="dim">{item.count} {item.count === 1 ? "version" : "versions"}</Text>
          </Row>
        {/each}
      </Stack>
    {/if}
  {:else if history === null}
    <EmptyState title="Loading..." titleTone="dim" delayed />
  {:else if snapshots.length === 0}
    <EmptyState
      title="No versions of this file yet"
      hint="Versions are kept on save, on outside changes and before discards."
      titleTone="dim"
    />
  {:else}
    {@const exists = history.exists}
    <SplitPane label="Resize the versions" preset="list" bind:size={listWidth} max={480}>
      {#snippet first()}{@render versions()}{/snippet}
      {#snippet second()}{@render compare(exists)}{/snippet}
    </SplitPane>
  {/if}
</Dialog>
