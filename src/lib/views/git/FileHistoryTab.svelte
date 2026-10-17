<!-- Show History: the commits that changed one file (`git log --follow`, renames followed),
     newest first and paged, with the selected commit's details and that file's diff below. -->
<script lang="ts">
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import List from "@nibtree/ui/components/List.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import Spinner from "@nibtree/ui/components/Spinner.svelte";
  import SplitPane from "@nibtree/ui/components/SplitPane.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import Toolbar from "@nibtree/ui/components/Toolbar.svelte";
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import CommitDetails from "$lib/log/CommitDetails.svelte";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { gitTabPath } from "$lib/stores/gitTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { FileHistoryEntry } from "$lib/types";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";

  interface Props {
    repoRoot: string;
    filePath: string;
  }

  let { repoRoot, filePath }: Props = $props();

  const PAGE_SIZE = 200;

  let entries = $state.raw<FileHistoryEntry[]>([]);
  let hasMore = $state(true);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let listHeight = $state(260);
  let token = 0;
  const now = Date.now();

  const selected = $derived(entries.find((entry) => entry.commit.id === selectedId) ?? null);
  // CommitDetails mounts again per commit, so one token is enough.
  const preferredFile = $derived(
    selected ? { commitId: selected.commit.id, path: selected.path, line: null, token: 1 } : null,
  );

  $effect(() => {
    void repoRoot;
    void filePath;
    untrack(() => void reload());
  });

  async function reload(): Promise<void> {
    const current = ++token;
    loading = true;
    loadError = null;
    try {
      const page = await api.fileHistory(repoRoot, filePath, 0, PAGE_SIZE);
      if (current !== token) {
        return;
      }
      entries = page;
      hasMore = page.length >= PAGE_SIZE;
      selectedId = page[0]?.commit.id ?? null;
    } catch (error) {
      if (current === token) {
        loadError = errorMessage(error);
      }
    } finally {
      if (current === token) {
        loading = false;
      }
    }
  }

  async function loadMore(): Promise<void> {
    if (loading || !hasMore) {
      return;
    }
    const current = token;
    loading = true;
    try {
      const page = await api.fileHistory(repoRoot, filePath, entries.length, PAGE_SIZE);
      if (current === token) {
        entries = [...entries, ...page];
        hasMore = page.length >= PAGE_SIZE;
      }
    } catch (error) {
      if (current === token) {
        toast.error("Could not load more history", errorMessage(error));
        hasMore = false;
      }
    } finally {
      if (current === token) {
        loading = false;
      }
    }
  }

  function loadedShortId(commitId: string): string | null {
    return entries.find((entry) => entry.commit.id === commitId)?.commit.shortId ?? null;
  }

  function onSelectCommit(commitId: string): void {
    if (entries.some((entry) => entry.commit.id === commitId)) {
      selectedId = commitId;
    } else {
      repoStore.openCommitTab(repoRoot, commitId);
    }
  }

  function openCommit(entry: FileHistoryEntry): void {
    repoStore.openCommitTab(repoRoot, entry.commit.id, { summary: entry.commit.summary, filePath: entry.path });
  }

  function compareWithWorkingCopy(entry: FileHistoryEntry): void {
    repoStore.openPseudoTab(gitTabPath({ kind: "compare", repoRoot, filePath, revision: entry.commit.id }));
  }

  async function copyHash(entry: FileHistoryEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.commit.id);
      toast.success("Copied revision hash", entry.commit.id);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function openMenu(event: MouseEvent, entry: FileHistoryEntry, fromKeys: boolean): void {
    contextMenu.open(
      event,
      [
        { label: "Open Commit in Tab", hint: "Enter", action: () => openCommit(entry) },
        { label: "Compare with Working Copy", action: () => compareWithWorkingCopy(entry) },
        { label: "Show in Log", action: () => void repoStore.showCommit(repoRoot, entry.commit.id, entry.path) },
        { separator: true },
        { label: "Copy Revision Hash", action: () => void copyHash(entry) },
      ],
      { keyboard: fromKeys },
    );
  }
</script>

<Stack gap="none" grow surface="panel">
  <Toolbar variant="panel" label="File history">
    <Icon name="history" size="normal" />
    <Text truncate title={filePath}>History of <Text mono>{filePath}</Text></Text>
    {#snippet end()}
      {#if loading}
        <Spinner size="small" />
      {/if}
      <Text size="small" tone="dim" tabular>
        {entries.length}{hasMore ? "+" : ""}
        {entries.length === 1 ? "commit" : "commits"}
      </Text>
      <IconButton
        icon="refresh"
        iconSize="normal"
        size="compact"
        tone="dim"
        label="Refresh"
        disabled={loading}
        onclick={() => void reload()}
      />
    {/snippet}
  </Toolbar>
  {#if loadError}
    <EmptyState title="Could not read the history" hint={loadError} />
  {:else}
    <SplitPane direction="column" preset="list" bind:size={listHeight} label="Resize the commit list" inPanel>
      {#snippet first()}
        <List
          items={entries}
          itemKey={(entry) => entry.commit.id}
          label="Commits"
          height="fill"
          bind:selected={selectedId}
          onnearend={() => void loadMore()}
          onactivate={openCommit}
          oncontextmenu={(event, entry, fromKeys) => openMenu(event, entry, fromKeys ?? false)}
        >
          {#snippet row(entry, state)}
            <Row selected={state.selected}>
              <Stack width="xsmall"><Text size="small" tone="dim" mono>{entry.commit.shortId}</Text></Stack>
              <Stack grow><Text truncate title={entry.commit.summary}>{entry.commit.summary}</Text></Stack>
              {#if entry.path !== filePath}
                <Text size="small" tone="warning" truncate giveWay title="The file was {entry.path} in this commit">
                  {entry.path}
                </Text>
              {/if}
              <Stack width="large"><Text size="small" tone="dim" truncate>{entry.commit.authorName}</Text></Stack>
              <Text size="small" tone="dim" title={fullDate(entry.commit.time)}>
                {relativeTime(entry.commit.time, now)}
              </Text>
            </Row>
          {/snippet}
          {#snippet empty()}
            {#if !loading}
              <EmptyState variant="panel" title="No commits touch this file yet." titleTone="dim" />
            {/if}
          {/snippet}
        </List>
      {/snippet}
      {#snippet second()}
        {#if selected}
          {#key selected.commit.id}
            <CommitDetails
              repoPath={repoRoot}
              commitId={selected.commit.id}
              {loadedShortId}
              {onSelectCommit}
              {preferredFile}
              onOpenInTab={(path) =>
                repoStore.openCommitTab(repoRoot, selected.commit.id, {
                  summary: selected.commit.summary,
                  filePath: path,
                })}
            />
          {/key}
        {/if}
      {/snippet}
    </SplitPane>
  {/if}
</Stack>
