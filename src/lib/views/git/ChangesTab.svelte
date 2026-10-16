<!-- The Changes tab (status bar > N changes): a repository's uncommitted files, each compared with HEAD (staged and
     unstaged together) or in the staging view. Follows the live status, and stages, unstages, discards and commits
     like the Changes sidebar. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { setDiffLayout, showsThreeColumns, showThreeColumns } from "$lib/diff/diffPanes";
  import ThreePaneDiff from "$lib/diff/ThreePaneDiff.svelte";
  import { STAGING_PANES_TITLE } from "$lib/diff/diffToolbar";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { MIN_CHANGES_LIST_WIDTH, settings } from "$lib/stores/settings.svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import type { RevisionDiff } from "$lib/types";
  import Button from "@git-manager/ui/components/Button.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import SplitPane from "@git-manager/ui/components/SplitPane.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import StatusLetter from "@git-manager/ui/components/StatusLetter.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import ChangesTabList from "./ChangesTabList.svelte";
  import { splitPath } from "../changes/fileStatus";
  import { indexEol, StagingDiffs, stagingViewFits } from "../changes/stagingDiffs.svelte";
  import { type ChangesTabFile, changesListBounds, changesTabFiles, pickSelected, stepSelection } from "./changesTab";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  const repo = $derived(repoStore.repos.find((candidate) => candidate.root === repoRoot) ?? null);
  const status = $derived(repoStore.statuses[repoRoot] ?? null);
  const files = $derived(changesTabFiles(status?.files ?? []));
  const unborn = $derived(status?.head.unborn ?? false);
  let selectedPath = $state<string | null>(null);
  const selected = $derived(pickSelected(files, selectedPath));

  /** The loaded diff and the file it belongs to, so a new selection never shows the old diff. */
  let loaded = $state.raw<{ path: string; diff: RevisionDiff } | null>(null);
  const result = $derived(loaded && loaded.path === selected?.path ? loaded.diff : null);
  let failed = $state.raw<{ path: string; message: string } | null>(null);
  const diffError = $derived(failed && failed.path === selected?.path ? failed.message : null);
  let diffToken = 0;
  /** Bumped on every diff load, so a binary preview reads the work tree file again. */
  let previewVersion = $state(0);
  let refreshing = $state(false);
  let bodyWidth = $state(0);
  const listVisible = $derived(settings.changesListVisible);
  const list = $derived(changesListBounds(settings.changesListWidth, bodyWidth, MIN_CHANGES_LIST_WIDTH));
  const selectedIndex = $derived(selected ? files.findIndex((file) => file.path === selected.path) : -1);
  const repoName = $derived(repo?.name ?? splitPath(repoRoot).name);
  /** Settings > Git > Commit box: Per repository puts the box above the files, as in the sidebar. */
  const perRepo = $derived(settings.commitBoxLayout === "perRepo");

  // A new status object, or a file edited again with the same status, loads the diff again.
  $effect(() => {
    const file = selected;
    void status;
    void repoStore.fileVersions[repoRoot];
    untrack(() => void loadDiff(file));
  });

  async function loadDiff(file: ChangesTabFile | null): Promise<void> {
    const token = ++diffToken;
    if (!file || file.submodule || unborn) {
      loaded = null;
      failed = null;
      return;
    }
    try {
      const next = await api.compareWithRevision(repoRoot, file.path, "HEAD", file.origPath);
      if (token === diffToken) {
        loaded = { path: file.path, diff: next };
        failed = null;
        previewVersion++;
      }
    } catch (error) {
      if (token === diffToken) {
        loaded = null;
        failed = { path: file.path, message: errorMessage(error) };
      }
    }
  }

  // The staging view of a plain modified file, on the same Three panes setting as the Changes diff.
  const staging = new StagingDiffs();
  const stagingFits = $derived(selected ? stagingViewFits(selected.status) : false);
  const stagingOn = $derived(stagingFits && showsThreeColumns("changesDiffPanes"));
  const stagingKey = $derived(selected ? `${repoRoot}\u0000${selected.path}` : null);
  $effect(() => {
    const file = selected;
    if (!file || !stagingOn) {
      untrack(() => staging.clear());
      return;
    }
    // A new status (after staging a change) reloads both diffs.
    void status;
    void repoStore.fileVersions[repoRoot];
    untrack(() => void staging.load(repoRoot, file.path));
  });

  let stageQueue: Promise<unknown> = Promise.resolve();
  /** Writes the index pane's new text; serialized so rapid clicks reach the index in order. */
  function applyToIndex(content: string, side: "left" | "right"): void {
    const [filePath, staged] = [selected?.path, staging.staged];
    if (!filePath || !staged) {
      return;
    }
    const label = side === "right" ? "Stage change" : "Unstage change";
    const write = (repoPath: string) => api.stageContent(repoPath, filePath, content, indexEol(staged));
    stageQueue = stageQueue.then(() => repoStore.run(label, write, { repoPath: repoRoot, refresh: "status" }));
  }

  const previewSides = $derived.by((): PreviewSides | null => {
    if (!result || !selected) {
      return null;
    }
    return {
      original: result.existsInRevision
        ? { kind: "revision", repoRoot, revision: result.commitId, filePath: selected.origPath ?? selected.path }
        : null,
      modified: { kind: "worktree", filePath: joinPath(repoRoot, selected.path) },
      version: previewVersion,
    };
  });

  function select(file: ChangesTabFile | null): void {
    if (file) {
      selectedPath = file.path;
      document.getElementById(rowId(file))?.scrollIntoView({ block: "nearest" });
    }
  }

  function openFile(file: ChangesTabFile): void {
    if (file.kind !== "deleted" && !file.submodule) {
      void repoStore.openFile(joinPath(repoRoot, file.path), { pin: true });
    }
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      select(stepSelection(files, selected?.path ?? null, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && selected) {
      openFile(selected);
    }
  }

  function rowId(file: ChangesTabFile): string {
    return `changes-tab-${encodeURIComponent(file.path)}`;
  }

  async function refresh(): Promise<void> {
    refreshing = true;
    try {
      await repoStore.refreshRepoStatus(repoRoot);
    } finally {
      refreshing = false;
    }
  }
</script>

{#snippet diffArea()}
  <Stack gap="none" grow surface="editor">
    {#if !selected}
      <EmptyState titleTone="dim" title="Nothing to show: the working tree matches the last commit." />
    {:else if selected.submodule}
      <EmptyState titleTone="dim" title="{selected.path} is a submodule. Open it as a repository to see its changes." />
    {:else if unborn}
      <EmptyState titleTone="dim" title="No commits yet, so every file is new. Open a file to see it." />
    {:else if diffError}
      <EmptyState titleTone="dim" title={diffError} />
    {:else if stagingOn && staging.staged && staging.workTree && staging.key === stagingKey}
      {#key stagingKey}
        <ThreePaneDiff
          left={staging.staged}
          right={staging.workTree}
          path={selected.path}
          labels={{ left: "HEAD", result: "Index (staged)", right: "Working Tree" }}
          label="Staging view of {selected.path.split('/').pop()}"
          options={{ rightNewer: true, conflicts: false }}
          applyTitles={{ left: "Unstage this change", right: "Stage this change" }}
          onapply={applyToIndex}
          onlayout={(layout) => setDiffLayout("changesDiffPanes", layout)}
          workingFile={{ filePath: joinPath(repoRoot, selected.path), sameLines: true }}
          blame={{ target: { repoRoot, filePath: selected.path, revision: null }, pane: "right" }}
        />
      {/key}
    {:else if result}
      {#key selected.path}
        <DiffView
          diff={result.diff}
          path={selected.path}
          mode="readonly"
          leftLabel="HEAD"
          rightLabel="Working Tree"
          workingFile={selected.kind === "deleted"
            ? null
            : { filePath: joinPath(repoRoot, selected.path), sameLines: true }}
          {previewSides}
          blame={selected.kind === "deleted" ? null : { repoRoot, filePath: selected.path, revision: null }}
          threePanes={stagingFits
            ? { title: STAGING_PANES_TITLE, open: () => showThreeColumns("changesDiffPanes") }
            : null}
        />
      {/key}
    {:else}
      <EmptyState titleTone="dim" title="Loading..." delayed />
    {/if}
  </Stack>
{/snippet}

<Stack gap="none" grow surface="panel">
  <Toolbar label="Uncommitted changes" variant="tab">
    <Icon name="git-compare" size="normal" />
    <Text truncate>Uncommitted changes in <Text weight="semibold">{repoName}</Text></Text>
    {#if !listVisible && selected}
      <!-- With the list hidden, the toolbar says which file the diff shows. -->
      <Stack direction="row" align="center" gap="sm" shrink>
        <StatusLetter kind={selected.kind} />
        <Text truncate title={selected.path}>{selected.path}</Text>
        <Text tone="dim" tabular>{selectedIndex + 1} of {files.length}</Text>
      </Stack>
    {/if}
    {#snippet end()}
      <Button
        icon="arrow-up"
        onclick={() => select(stepSelection(files, selected?.path ?? null, -1))}
        disabled={selectedIndex <= 0}
        title="Previous file"
        aria-label="Previous file"
      />
      <Button
        icon="arrow-down"
        onclick={() => select(stepSelection(files, selected?.path ?? null, 1))}
        disabled={selectedIndex < 0 || selectedIndex >= files.length - 1}
        title="Next file"
        aria-label="Next file"
      />
      <Button
        layout={perRepo ? "commit-per-repo" : "commit-single"}
        onclick={() => settings.setPreference("commitBoxLayout", perRepo ? "single" : "perRepo")}
        title={perRepo ? "Show One Commit Box" : "Show a Commit Box per Repository"}
        aria-label="Commit box per repository"
        aria-pressed={perRepo}
      />
      <Button
        layout="sidebar-left"
        layoutActive={listVisible}
        onclick={() => settings.toggleChangesList()}
        title={listVisible ? "Hide file list" : "Show file list"}
        aria-label={listVisible ? "Hide file list" : "Show file list"}
        aria-pressed={listVisible}
      />
      <Button
        icon="refresh"
        spinning={refreshing}
        onclick={() => void refresh()}
        title="Refresh"
        aria-label="Refresh"
      />
    {/snippet}
  </Toolbar>
  {#if !repo}
    <EmptyState titleTone="dim" title="This repository is no longer open." />
  {:else if !status}
    <EmptyState titleTone="dim" title="Loading..." delayed />
  {:else if listVisible}
    <SplitPane
      bind:size={() => list.width, (width) => (settings.changesListWidth = width)}
      bind:extent={bodyWidth}
      preset="files"
      max={list.max}
      inPanel
      label="Resize file list"
      oncommit={() => settings.save()}
    >
      {#snippet first()}
        <ChangesTabList
          {repoRoot}
          {repo}
          {repoName}
          {files}
          {selected}
          {onkeydown}
          onselect={select}
          onopen={openFile}
        />
      {/snippet}
      {#snippet second()}{@render diffArea()}{/snippet}
    </SplitPane>
  {:else}
    <Stack direction="row" gap="none" grow>{@render diffArea()}</Stack>
  {/if}
</Stack>
