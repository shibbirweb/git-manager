<!-- Show History for Selection: the commits that changed some lines of a file
     (`git log -L`), newest first, with each commit's diff of those lines. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import List from "@git-manager/ui/components/List.svelte";
  import PatchView from "@git-manager/ui/components/PatchView.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import SplitPane from "@git-manager/ui/components/SplitPane.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { LineHistoryEntry } from "$lib/types";

  interface Props {
    repoRoot: string;
    filePath: string;
    startLine: number;
    endLine: number;
  }

  let { repoRoot, filePath, startLine, endLine }: Props = $props();

  const LIMIT = 200;

  let entries = $state.raw<LineHistoryEntry[]>([]);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let listHeight = $state(220);
  let token = 0;
  const now = Date.now();

  const selected = $derived(entries.find((entry) => entry.commit.id === selectedId) ?? null);
  const rangeLabel = $derived(startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`);

  $effect(() => {
    void [repoRoot, filePath, startLine, endLine];
    untrack(() => void load());
  });

  async function load(): Promise<void> {
    const current = ++token;
    loading = true;
    loadError = null;
    try {
      const result = await api.lineHistory(repoRoot, filePath, startLine, endLine, LIMIT);
      if (current === token) {
        entries = result;
        selectedId = result[0]?.commit.id ?? null;
      }
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

  function openCommit(entry: LineHistoryEntry): void {
    repoStore.openCommitTab(repoRoot, entry.commit.id, { summary: entry.commit.summary, filePath });
  }
</script>

<Stack gap="none" grow surface="panel">
  <Toolbar variant="panel" label="Line history">
    <Icon name="history" size="normal" />
    <Text truncate title={filePath}>History of {rangeLabel} of <Text mono>{filePath}</Text></Text>
    {#snippet end()}
      <Text size="small" tone="dim" tabular>
        {#if loading}
          Loading...
        {:else}
          {entries.length}{entries.length >= LIMIT ? "+" : ""} {entries.length === 1 ? "commit" : "commits"}
        {/if}
      </Text>
      <IconButton
        icon="refresh"
        iconSize="normal"
        size="compact"
        tone="dim"
        label="Refresh"
        disabled={loading}
        onclick={() => void load()}
      />
    {/snippet}
  </Toolbar>
  {#if loadError}
    <EmptyState
      title="Could not trace these lines"
      hint="{loadError} Line numbers are those of the last commit when the tab opened; newer commits can shift them."
    />
  {:else}
    <SplitPane direction="column" preset="list" bind:size={listHeight} label="Resize the commit list" inPanel>
      {#snippet first()}
        <List
          items={entries}
          itemKey={(entry) => entry.commit.id}
          label="Commits"
          height="fill"
          bind:selected={selectedId}
          onactivate={openCommit}
        >
          {#snippet row(entry, state)}
            <Row selected={state.selected}>
              <Stack width="xsmall"><Text size="small" tone="dim" mono>{entry.commit.shortId}</Text></Stack>
              <Stack grow><Text truncate title={entry.commit.summary}>{entry.commit.summary}</Text></Stack>
              <Stack width="large"><Text size="small" tone="dim" truncate>{entry.commit.authorName}</Text></Stack>
              <Text size="small" tone="dim" title={fullDate(entry.commit.time)}>
                {relativeTime(entry.commit.time, now)}
              </Text>
            </Row>
          {/snippet}
          {#snippet empty()}
            {#if !loading}
              <EmptyState variant="panel" title="No commits changed these lines." titleTone="dim" />
            {/if}
          {/snippet}
        </List>
      {/snippet}
      {#snippet second()}
        {#if selected}
          <Stack gap="none" grow>
            <Toolbar variant="compact" label="Commit">
              <Text truncate>{selected.commit.summary}</Text>
              {#snippet end()}
                <Button size="small" onclick={() => openCommit(selected)}>Open Commit</Button>
              {/snippet}
            </Toolbar>
            <PatchView
              label="Changes to these lines"
              patch={selected.patch}
              note={selected.truncated ? "... the diff is cut short; open the commit to see all of it" : ""}
            />
          </Stack>
        {/if}
      {/snippet}
    </SplitPane>
  {/if}
</Stack>
