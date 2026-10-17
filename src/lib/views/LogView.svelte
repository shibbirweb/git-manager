<!-- The Log: a filter bar, the commit table and the selected commit's details under it. The history loads in
     log/logHistory.svelte.ts, the rows draw in log/LogTable.svelte and the right-click menu is log/commitMenu.ts. -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import EmptyState from "@nibtree/ui/components/EmptyState.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import SearchField from "@nibtree/ui/components/SearchField.svelte";
  import Spinner from "@nibtree/ui/components/Spinner.svelte";
  import SplitPane from "@nibtree/ui/components/SplitPane.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import ToggleButton from "@nibtree/ui/components/ToggleButton.svelte";
  import Toolbar from "@nibtree/ui/components/Toolbar.svelte";
  import { untrack } from "svelte";
  import { withCommandKeys } from "$lib/commands/commandRuntime";
  import CommitDetails from "$lib/log/CommitDetails.svelte";
  import { openCommitMenu } from "$lib/log/commitMenu";
  import { countLabel, matchesQuery, matchingEntries } from "$lib/log/logFilter";
  import { LogHistory } from "$lib/log/logHistory.svelte";
  import { logSelection } from "$lib/log/logSelection.svelte";
  import LogTable from "$lib/log/LogTable.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { bisectStore } from "./git/bisect.svelte";
  import { bisectBadges } from "./git/bisectBanner";

  const history = new LogHistory();
  let firstTrigger = true;
  let filterText = $state("");
  let filterField = $state<HTMLInputElement | null>(null);
  let table = $state<ReturnType<typeof LogTable> | null>(null);
  let paneHeight = $state(0);
  let listFraction = $state(0.55);

  const repoPath = $derived(repoStore.repo?.root ?? null);
  const bisecting = $derived(repoPath !== null && (repoStore.statuses[repoPath]?.bisect ?? null) !== null);
  /** Good, bad, skipped and tested commits while a bisect runs (BisectBanner keeps the state fresh). */
  const bisectMarks = $derived(bisectBadges(bisecting ? bisectStore.forRepo(repoPath) : null));
  const query = $derived(filterText.trim().toLowerCase());
  const loadedCount = $derived.by(() => {
    void history.version;
    return history.entries.length;
  });
  const shown = $derived.by(() => {
    void history.version;
    return matchingEntries(history.entries, query) ?? [...history.entries];
  });
  const countText = $derived(countLabel(loadedCount, history.hasMore, query ? shown.length : null));
  const listSize = $derived(paneHeight ? Math.round(listFraction * paneHeight) : 300);

  $effect(() => {
    void repoStore.historyVersion;
    const allRefs = settings.logAllRefs;
    const target = repoPath;
    const immediate = firstTrigger || target !== untrack(() => history.repoPath);
    firstTrigger = false;
    const timer = setTimeout(() => void history.reload(target, allRefs), immediate ? 0 : 150);
    return () => clearTimeout(timer);
  });

  // The Git menu's Create Patch from Commit and Interactive Rebase start from the selected commit.
  $effect(() => {
    void history.version;
    const commit = history.selected ? (history.entry(history.selected)?.commit ?? null) : null;
    logSelection.current =
      commit && repoPath
        ? { repoRoot: repoPath, commitId: commit.id, shortId: commit.shortId, summary: commit.summary }
        : null;
  });

  $effect(() => () => {
    logSelection.current = null;
  });

  function refresh(): void {
    history.forget();
    void history.reload(repoPath, settings.logAllRefs);
  }

  function setAllRefs(allRefs: boolean): void {
    settings.logAllRefs = allRefs;
    settings.save();
  }

  function loadMore(): void {
    void history.loadMore(repoPath, settings.logAllRefs);
  }

  /** Opens a commit in its own editor tab, on `filePath` when given. */
  function openInTab(commitId: string, filePath: string | null = null): void {
    if (repoPath) {
      const summary = history.entry(commitId)?.commit.summary ?? null;
      repoStore.openCommitTab(repoPath, commitId, { summary, filePath });
    }
  }

  /** A parent or child commit picked in the details: select it, clearing a filter that hides it. */
  function selectCommit(commitId: string): void {
    const entry = history.entry(commitId);
    if (!entry) {
      return;
    }
    if (query && !matchesQuery(entry.commit, query)) {
      filterText = "";
    }
    history.selected = commitId;
    table?.focus();
    void table?.reveal(commitId);
  }

  // A commit requested from elsewhere (blame): load history until it shows up.
  let handledFocus = 0;
  let focusFile = $state<{
    commitId: string;
    path: string;
    line: number | null;
    lineText: string | null;
    token: number;
  } | null>(null);

  $effect(() => {
    const focus = repoStore.logFocus;
    void history.version;
    if (!focus || focus.token === handledFocus || focus.repoRoot !== repoPath || !repoPath) {
      return;
    }
    if (!history.loaded || history.loading || history.repoPath !== repoPath) {
      return;
    }
    handledFocus = focus.token;
    const target = repoPath;
    untrack(() => {
      const { commitId, filePath, line, token } = focus;
      focusFile = filePath ? { commitId, path: filePath, line, lineText: focus.lineText ?? null, token } : null;
      void focusCommit(commitId, target);
    });
  });

  async function focusCommit(commitId: string, target: string): Promise<void> {
    filterText = "";
    const result = await history.find(commitId, target, settings.logAllRefs);
    if (result === "stale") {
      return;
    }
    history.selected = commitId;
    if (result === "missing") {
      toast.info("Commit is not in the loaded history", settings.logAllRefs ? undefined : "Try showing all branches.");
      return;
    }
    void table?.reveal(commitId, "center");
  }

  function loadedShortId(commitId: string): string | null {
    void history.version;
    return history.entry(commitId)?.commit.shortId ?? null;
  }
</script>

{#snippet commitTable()}
  {#key history.repoPath}
    <LogTable
      bind:this={table}
      entries={shown}
      bind:selected={history.selected}
      laneCount={history.laneCount}
      filtered={query !== ""}
      {bisectMarks}
      field={filterField}
      onopen={(commitId) => openInTab(commitId)}
      oncontextmenu={(event, entry) => openCommitMenu(event, entry.commit, { repoPath, bisecting, openInTab })}
      onnearend={() => {
        if (!query && !history.error) {
          loadMore();
        }
      }}
    >
      {#snippet empty()}
        <EmptyState title={`No loaded commits match "${filterText.trim()}".`} titleTone="dim" />
      {/snippet}
    </LogTable>
  {/key}
{/snippet}

<Stack gap="none" grow role="region" label="Log">
  <Toolbar variant="log" label="Log">
    <SearchField
      label="Filter commits"
      placeholder="Filter by message, author or hash"
      width="large"
      bind:value={filterText}
      bind:element={filterField}
    />
    <ToggleButton
      variant="filter"
      icon="branch"
      text="All branches"
      label="All branches"
      title="Show commits from all local and remote branches"
      pressed={settings.logAllRefs}
      onchange={setAllRefs}
    />
    <IconButton icon="refresh" iconSize="normal" label="Refresh history" disabled={history.loading} onclick={refresh} />
    {#snippet end()}
      {#if history.loading && history.loaded}
        <Spinner label="Loading history" />
      {/if}
      {#if history.loaded && loadedCount > 0}
        <Text tone="dim" size="compact">{countText}</Text>
      {/if}
      {#if query && history.hasMore && history.loaded}
        <Button
          size="small"
          disabled={history.loading}
          title="Load the next page of history to search it"
          onclick={loadMore}
        >
          Load more
        </Button>
      {/if}
      <IconButton
        icon="x"
        iconSize="normal"
        label="Hide log"
        title={withCommandKeys("Hide Log", "view.log")}
        onclick={() => changesSelection.toggleLog()}
      />
    {/snippet}
  </Toolbar>

  {#if !history.loaded}
    <EmptyState title="Loading history..." titleTone="dim" delayed />
  {:else if history.error && loadedCount === 0}
    <EmptyState icon="alert" title="Could not load history" hint={history.error} titleTone="danger">
      {#snippet action()}<Button size="small" onclick={refresh}>Retry</Button>{/snippet}
    </EmptyState>
  {:else if loadedCount === 0}
    <EmptyState
      icon="commit"
      titleTone="dim"
      title={repoStore.status?.head.unborn ? "This repository has no commits yet." : "No commits to show."}
    />
  {:else if history.selected && repoPath}
    <SplitPane
      direction="column"
      label="Resize the commit list"
      preset="list"
      bind:extent={paneHeight}
      max={Math.max(120, Math.round(paneHeight * 0.85))}
      bind:size={() => listSize, (size) => (listFraction = paneHeight ? size / paneHeight : listFraction)}
    >
      {#snippet first()}{@render commitTable()}{/snippet}
      {#snippet second()}
        <CommitDetails
          {repoPath}
          commitId={history.selected ?? ""}
          {loadedShortId}
          onSelectCommit={selectCommit}
          preferredFile={focusFile}
          onOpenInTab={(filePath) => history.selected && openInTab(history.selected, filePath)}
        />
      {/snippet}
    </SplitPane>
  {:else}
    {@render commitTable()}
  {/if}
</Stack>
