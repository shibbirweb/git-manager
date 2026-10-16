<!-- Branches popup > Compare with Current: the commits the branch has that the current branch
     lacks and the other way round, and the files that differ, each with its diff (the current
     branch on the left). A commit opens in its own tab. Reloads when refs change. -->
<script lang="ts">
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import SectionTitle from "@git-manager/ui/components/SectionTitle.svelte";
  import Spinner from "@git-manager/ui/components/Spinner.svelte";
  import SplitPane from "@git-manager/ui/components/SplitPane.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import { untrack } from "svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import { api, errorMessage } from "$lib/api";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { BranchComparison, ChangedFile, CommitSummary, FileDiff } from "$lib/types";
  import BranchFileList from "./BranchFileList.svelte";

  interface Props {
    repoRoot: string;
    branchName: string;
    baseName: string;
  }

  let { repoRoot, branchName, baseName }: Props = $props();

  let comparison = $state.raw<BranchComparison | null>(null);
  let loadError = $state<string | null>(null);
  let loading = $state(false);
  let selected = $state.raw<ChangedFile | null>(null);
  let diff = $state.raw<FileDiff | null>(null);
  let diffError = $state<string | null>(null);
  let sideWidth = $state(360);
  let loadToken = 0;
  let diffToken = 0;
  const now = Date.now();

  $effect(() => {
    void repoStore.historyVersion;
    void repoRoot;
    void branchName;
    void baseName;
    untrack(() => void load());
  });

  async function load(): Promise<void> {
    const token = ++loadToken;
    loading = true;
    try {
      const next = await api.compareBranches(repoRoot, branchName, baseName);
      if (token !== loadToken) {
        return;
      }
      comparison = next;
      loadError = null;
      const keep = next.files.find((file) => file.path === selected?.path) ?? next.files[0] ?? null;
      void select(keep);
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
      }
    } finally {
      if (token === loadToken) {
        loading = false;
      }
    }
  }

  /** The base branch (the old path of a rename) against the compared branch, both commits. */
  const previewSides = $derived.by((): PreviewSides | null => {
    if (!comparison || !selected) {
      return null;
    }
    return {
      original: {
        kind: "revision",
        repoRoot,
        revision: comparison.baseId,
        filePath: selected.origPath ?? selected.path,
      },
      modified: { kind: "revision", repoRoot, revision: comparison.branchId, filePath: selected.path },
    };
  });

  async function select(file: ChangedFile | null): Promise<void> {
    selected = file;
    const token = ++diffToken;
    if (!file || !comparison) {
      diff = null;
      return;
    }
    try {
      const next = await api.revisionsFileDiff(
        repoRoot,
        comparison.baseId,
        comparison.branchId,
        file.path,
        file.origPath,
      );
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

  function openCommit(commit: CommitSummary): void {
    repoStore.openCommitTab(repoRoot, commit.id, { summary: commit.summary });
  }
</script>

{#snippet commitList(title: string, commits: CommitSummary[])}
  <SectionTitle {title} count={commits.length} />
  {#each commits as commit (commit.id)}
    <Row title="Open {commit.shortId} in a tab" onclick={() => openCommit(commit)}>
      <Stack width="xsmall"><Text size="small" tone="dim" mono>{commit.shortId}</Text></Stack>
      <Stack grow><Text truncate>{commit.summary}</Text></Stack>
      <Text size="small" tone="dim">{relativeTime(commit.time, now)}</Text>
    </Row>
  {:else}
    <Stack paddingX="mdPlus" paddingY="xs"><Text size="small" tone="dim">None</Text></Stack>
  {/each}
{/snippet}

<Stack gap="none" grow surface="panel">
  <Toolbar variant="panel" label="Branch comparison">
    <Icon name="git-compare" size="normal" />
    <Text truncate>
      <Text weight="semibold">{branchName}</Text> compared with <Text weight="semibold">{baseName}</Text>
    </Text>
    {#if loading}
      <Spinner size="small" />
    {/if}
    {#snippet end()}
      <IconButton
        icon="refresh"
        iconSize="medium"
        size="compact"
        tone="dim"
        label="Refresh"
        onclick={() => void load()}
      />
    {/snippet}
  </Toolbar>
  {#if loadError}
    <EmptyState icon="alert" title="Could not compare {branchName} with {baseName}" hint={loadError} />
  {:else if comparison}
    {@const shown = comparison}
    <SplitPane label="Resize the comparison lists" preset="files" bind:size={sideWidth} inPanel>
      {#snippet first()}
        <Stack gap="none" grow>
          <Stack gap="none" scroll="y" maxHeight="large" line="bottom" label="Commits">
            {@render commitList(`In ${branchName}, not in ${baseName}`, shown.branchOnly)}
            {@render commitList(`In ${baseName}, not in ${branchName}`, shown.baseOnly)}
            {#if shown.truncated}
              <Stack paddingX="mdPlus" paddingY="xs">
                <Text size="small" tone="dim">Only the first 1000 commits of each side are listed.</Text>
              </Stack>
            {/if}
          </Stack>
          <SectionTitle title="Files that differ" count={shown.files.length} />
          <Stack gap="none" grow scroll="y">
            <BranchFileList
              files={shown.files}
              selectedPath={selected?.path ?? null}
              onselect={(file) => void select(file)}
            />
          </Stack>
        </Stack>
      {/snippet}
      {#snippet second()}
        <Stack gap="none" grow surface="editor">
          {#if diffError}
            <EmptyState title={diffError} titleTone="dim" />
          {:else if diff && selected}
            {#key `${shown.baseId}:${shown.branchId}:${selected.path}`}
              <DiffView
                {diff}
                path={selected.path}
                mode="readonly"
                leftLabel={baseName}
                rightLabel={branchName}
                workingFile={{ filePath: joinPath(repoRoot, selected.path), sameLines: false }}
                {previewSides}
              />
            {/key}
          {:else}
            <EmptyState
              title={shown.files.length === 0 ? "The branches have the same files." : "Select a file"}
              titleTone="dim"
            />
          {/if}
        </Stack>
      {/snippet}
    </SplitPane>
  {:else}
    <EmptyState title="Loading..." titleTone="dim" delayed />
  {/if}
</Stack>
