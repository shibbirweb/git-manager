<!-- Git > Show Reflog: where HEAD (or a branch) pointed before, newest first, paged and
     virtualized, with the selected entry's commit below and actions to go back to it. -->
<script lang="ts">
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import List from "@nibtree/ui/components/List.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import Select from "@nibtree/ui/components/Select.svelte";
  import Spinner from "@nibtree/ui/components/Spinner.svelte";
  import SplitPane from "@nibtree/ui/components/SplitPane.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import Toolbar from "@nibtree/ui/components/Toolbar.svelte";
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import CommitDetails from "$lib/log/CommitDetails.svelte";
  import { fullDate, relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ReflogEntry } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { newBranchFrom, repoTarget } from "../sidebar/actions";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { hasCommit, reflogActionLabel, reflogActionTone } from "./reflogView";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  const PAGE_SIZE = 300;

  let refName = $state("HEAD");
  let branches = $state.raw<string[]>([]);
  let entries = $state.raw<ReflogEntry[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let selectedKey = $state<string | null>(null);
  let listHeight = $state(260);
  let token = 0;
  const now = Date.now();

  const selected = $derived(entries.find((entry) => entryKey(entry) === selectedKey) ?? null);
  const refOptions = $derived([
    { value: "HEAD", label: "HEAD" },
    ...branches.map((branchName) => ({ value: branchName, label: branchName })),
  ]);
  const hasMore = $derived(entries.length < total);
  const busy = $derived(repoStore.busy !== null);
  // HEAD or a branch moved: the reflog has a new entry.
  const headVersion = $derived(repoRoot === repoStore.repo?.root ? repoStore.historyVersion : 0);

  $effect(() => {
    void repoRoot;
    void refName;
    void headVersion;
    untrack(() => void reload());
  });

  $effect(() => {
    void repoRoot;
    untrack(() => void loadBranches());
  });

  async function loadBranches(): Promise<void> {
    const refs = repoRoot === repoStore.repo?.root ? repoStore.refs : await api.getRefs(repoRoot).catch(() => null);
    branches = refs?.local.map((branch) => branch.name) ?? [];
  }

  async function reload(): Promise<void> {
    const current = ++token;
    loading = true;
    loadError = null;
    try {
      const page = await api.getReflog(repoRoot, refName === "HEAD" ? null : refName, 0, PAGE_SIZE);
      if (current !== token) {
        return;
      }
      entries = page.entries;
      total = page.total;
      selectedKey = page.entries.length > 0 ? entryKey(page.entries[0]) : null;
    } catch (error) {
      if (current === token) {
        entries = [];
        total = 0;
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
      const page = await api.getReflog(repoRoot, refName === "HEAD" ? null : refName, entries.length, PAGE_SIZE);
      if (current === token) {
        entries = [...entries, ...page.entries];
        total = page.entries.length === 0 ? entries.length : page.total;
      }
    } catch (error) {
      if (current === token) {
        toast.error("Could not load more of the reflog", errorMessage(error));
        total = entries.length;
      }
    } finally {
      if (current === token) {
        loading = false;
      }
    }
  }

  function entryKey(entry: ReflogEntry): string {
    return String(entry.index);
  }

  function showCommit(entry: ReflogEntry): void {
    if (hasCommit(entry)) {
      repoStore.openCommitTab(repoRoot, entry.newId, { summary: entry.detail || null });
    }
  }

  async function checkout(entry: ReflogEntry): Promise<void> {
    const confirmed = await dialogs.confirm({
      title: "Checkout Revision",
      message:
        `Check out ${entry.newShortId} (${entry.selector}) in detached HEAD state? ` +
        "New commits there will not belong to any branch until you create one.",
      confirmLabel: "Checkout",
    });
    if (!confirmed) {
      return;
    }
    await repoStore.run("Checkout", (repoPath) => api.checkoutCommit(repoPath, entry.newId), {
      repoPath: repoRoot,
      success: `HEAD is now at ${entry.newShortId}`,
    });
  }

  function resetHere(entry: ReflogEntry): void {
    gitDialogs.open({ kind: "reset", repoRoot, revision: entry.newId });
  }

  async function copyHash(entry: ReflogEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.newId);
      toast.success("Copied revision hash", entry.newId);
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  function openMenu(event: MouseEvent, entry: ReflogEntry, fromKeys: boolean): void {
    const commit = hasCommit(entry);
    const operation = (repoStore.statuses[repoRoot]?.op.kind ?? "none") !== "none";
    const items: MenuItem[] = [
      { label: "Show Commit", hint: "Enter", disabled: !commit, action: () => showCommit(entry) },
      { label: "Copy Revision Hash", disabled: !commit, action: () => void copyHash(entry) },
      { separator: true },
      {
        label: "New Branch Here...",
        disabled: !commit || busy,
        action: () => void newBranchFrom(entry.newId, "", repoTarget(repoRoot, repoStore.refs)),
      },
      { label: "Checkout Revision", disabled: !commit || busy, action: () => void checkout(entry) },
      { separator: true },
      {
        label: "Reset Current Branch to Here...",
        disabled: !commit || busy || operation,
        action: () => resetHere(entry),
      },
    ];
    contextMenu.open(event, items, { keyboard: fromKeys });
  }

  function loadedShortId(commitId: string): string | null {
    return entries.find((entry) => entry.newId === commitId)?.newShortId ?? null;
  }
</script>

<Stack gap="none" grow surface="panel">
  <Toolbar variant="panel" label="Reflog">
    <Icon name="history" size="normal" />
    <Text weight="semibold">Reflog of</Text>
    <Select size="small" options={refOptions} bind:value={refName} label="Reference" />
    {#snippet end()}
      {#if loading}
        <Spinner size="small" />
      {/if}
      <Text size="small" tone="dim" tabular>{total} {total === 1 ? "entry" : "entries"}</Text>
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
    <EmptyState title="Could not read the reflog" hint={loadError} />
  {:else}
    <SplitPane direction="column" preset="list" bind:size={listHeight} label="Resize the reflog list" inPanel>
      {#snippet first()}
        <List
          items={entries}
          itemKey={entryKey}
          label="Reflog entries"
          height="fill"
          virtual="normal"
          bind:selected={selectedKey}
          onnearend={() => void loadMore()}
          onactivate={showCommit}
          oncontextmenu={(event, entry, fromKeys) => openMenu(event, entry, fromKeys ?? false)}
        >
          {#snippet row(entry, state)}
            <Row selected={state.selected}>
              <Stack width="medium"><Text size="small" tone="dim" mono>{entry.selector}</Text></Stack>
              <Stack width="xsmall"><Text size="small" tone="dim" mono>{entry.newShortId}</Text></Stack>
              <Stack width="small">
                <Text size="small" tone={reflogActionTone(entry.action)}>{reflogActionLabel(entry.action)}</Text>
              </Stack>
              <Stack grow><Text truncate title={entry.message}>{entry.detail || entry.message}</Text></Stack>
              <Text size="small" tone="dim" title={fullDate(entry.time)}>{relativeTime(entry.time, now)}</Text>
            </Row>
          {/snippet}
          {#snippet empty()}
            {#if !loading}
              <EmptyState variant="panel" title="This reference has no reflog entries." titleTone="dim" />
            {/if}
          {/snippet}
        </List>
      {/snippet}
      {#snippet second()}
        {#if selected && hasCommit(selected)}
          {#key selected.newId}
            <CommitDetails
              repoPath={repoRoot}
              commitId={selected.newId}
              {loadedShortId}
              onSelectCommit={(commitId) => repoStore.openCommitTab(repoRoot, commitId)}
              onOpenInTab={(path) => repoStore.openCommitTab(repoRoot, selected.newId, { filePath: path })}
            />
          {/key}
        {/if}
      {/snippet}
    </SplitPane>
  {/if}
</Stack>
