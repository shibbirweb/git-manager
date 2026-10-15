<!-- Branches popup > Show Diff with Working Tree: the files that differ between a branch and
     the working copy, each with its diff (the branch on the left). Reloads when files change. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import { api, errorMessage } from "$lib/api";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ChangedFile, RevisionDiff, WorktreeComparison } from "$lib/types";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Pane from "@git-manager/ui/components/Pane.svelte";
  import SectionTitle from "@git-manager/ui/components/SectionTitle.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import Toolbar from "@git-manager/ui/components/Toolbar.svelte";
  import BranchFileList from "./BranchFileList.svelte";

  interface Props {
    repoRoot: string;
    revision: string;
  }

  let { repoRoot, revision }: Props = $props();

  let comparison = $state.raw<WorktreeComparison | null>(null);
  let loadError = $state<string | null>(null);
  let selected = $state.raw<ChangedFile | null>(null);
  let result = $state.raw<RevisionDiff | null>(null);
  let diffError = $state<string | null>(null);
  let loadToken = 0;
  let diffToken = 0;
  /** Bumped on every diff load, so a binary preview reads the work tree file again. */
  let previewVersion = $state(0);

  /** A commit changes the status and moves the branch tips moments apart: one reload covers both. */
  const RELOAD_DELAY_MS = 150;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  let firstLoad = true;

  $effect(() => {
    // A new status object means files changed on disk; an unchanged status keeps its object,
    // so a file edited again shows through the file version.
    void repoStore.statuses[repoRoot];
    void repoStore.fileVersions[repoRoot];
    void repoStore.historyVersion;
    void revision;
    untrack(() => {
      clearTimeout(reloadTimer);
      if (firstLoad) {
        firstLoad = false;
        void load();
        return;
      }
      reloadTimer = setTimeout(() => void load(), RELOAD_DELAY_MS);
    });
  });

  $effect(() => () => clearTimeout(reloadTimer));

  async function load(): Promise<void> {
    const token = ++loadToken;
    try {
      const next = await api.compareWithWorktree(repoRoot, revision);
      if (token !== loadToken) {
        return;
      }
      comparison = next;
      loadError = null;
      void select(next.files.find((file) => file.path === selected?.path) ?? next.files[0] ?? null);
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
      }
    }
  }

  /** The branch's commit (none when the file is not in it) against the work tree. */
  const previewSides = $derived.by((): PreviewSides | null => {
    if (!result || !selected || !comparison) {
      return null;
    }
    return {
      original: result.existsInRevision
        ? { kind: "revision", repoRoot, revision: result.commitId, filePath: selected.path }
        : null,
      modified: { kind: "worktree", filePath: joinPath(repoRoot, selected.path) },
      version: previewVersion,
    };
  });

  async function select(file: ChangedFile | null): Promise<void> {
    selected = file;
    const token = ++diffToken;
    if (!file || !comparison) {
      result = null;
      return;
    }
    try {
      const next = await api.compareWithRevision(repoRoot, file.path, comparison.commitId);
      if (token === diffToken) {
        result = next;
        diffError = null;
        previewVersion++;
      }
    } catch (error) {
      if (token === diffToken) {
        result = null;
        diffError = errorMessage(error);
      }
    }
  }
</script>

<Stack gap="none" grow surface="panel">
  <Toolbar label="Compare" variant="tab">
    <Icon name="git-compare" size="normal" />
    <Text truncate><Text weight="semibold">{revision}</Text> compared with the working tree</Text>
    {#snippet end()}
      <Button icon="refresh" title="Refresh" aria-label="Refresh" onclick={() => void load()} />
    {/snippet}
  </Toolbar>
  {#if loadError}
    <EmptyState icon="alert" title="Could not compare {revision} with the working tree" hint={loadError} />
  {:else if comparison}
    <Stack direction="row" gap="none" grow>
      <Pane label="Files that differ" width="xlarge">
        <SectionTitle variant="list" title="Files that differ" count={comparison.files.length} />
        <BranchFileList
          files={comparison.files}
          selectedPath={selected?.path ?? null}
          onselect={(file) => void select(file)}
        />
      </Pane>
      <Stack gap="none" grow surface="editor">
        {#if diffError}
          <EmptyState titleTone="dim" title={diffError} />
        {:else if result && selected}
          {#key `${comparison.commitId}:${selected.path}`}
            <DiffView
              diff={result.diff}
              path={selected.path}
              mode="readonly"
              leftLabel={revision}
              rightLabel="Working Tree"
              workingFile={{ filePath: joinPath(repoRoot, selected.path), sameLines: true }}
              {previewSides}
            />
          {/key}
        {:else}
          <EmptyState
            titleTone="dim"
            title={comparison.files.length === 0 ? "The working tree matches this branch." : "Select a file"}
          />
        {/if}
      </Stack>
    </Stack>
  {:else}
    <EmptyState titleTone="dim" title="Loading..." delayed />
  {/if}
</Stack>
