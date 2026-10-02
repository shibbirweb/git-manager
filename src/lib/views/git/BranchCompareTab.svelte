<!-- Branches popup > Compare with Current: the commits the branch has that the current branch
     lacks and the other way round, and the files that differ, each with its diff (the current
     branch on the left). A commit opens in its own tab. Reloads when refs change. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import { api, errorMessage } from "$lib/api";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { BranchComparison, ChangedFile, CommitSummary, FileDiff } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
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
      original: { kind: "revision", repoRoot, revision: comparison.baseId, filePath: selected.origPath ?? selected.path },
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
      const next = await api.revisionsFileDiff(repoRoot, comparison.baseId, comparison.branchId, file.path, file.origPath);
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
  <div class="section-title">{title} <span class="dim">({commits.length})</span></div>
  {#each commits as commit (commit.id)}
    <button type="button" class="commit" onclick={() => openCommit(commit)} title="Open {commit.shortId} in a tab">
      <span class="hash mono">{commit.shortId}</span>
      <span class="subject truncate">{commit.summary}</span>
      <span class="when dim">{relativeTime(commit.time, now)}</span>
    </button>
  {:else}
    <div class="none dim">None</div>
  {/each}
{/snippet}

<div class="compare-tab">
  <div class="toolbar">
    <Icon name="git-compare" size={14} />
    <span class="title truncate"><strong>{branchName}</strong> compared with <strong>{baseName}</strong></span>
    {#if loading}<span class="spinner" aria-label="Loading"></span>{/if}
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={() => void load()} title="Refresh">
      <Icon name="refresh" size={13} />
    </button>
  </div>
  {#if loadError}
    <div class="placeholder">
      <Icon name="alert" size={18} />
      <div>Could not compare {branchName} with {baseName}</div>
      <div class="dim selectable">{loadError}</div>
    </div>
  {:else if comparison}
    <div class="body">
      <div class="side">
        <div class="commits">
          {@render commitList(`In ${branchName}, not in ${baseName}`, comparison.branchOnly)}
          {@render commitList(`In ${baseName}, not in ${branchName}`, comparison.baseOnly)}
          {#if comparison.truncated}
            <div class="none dim">Only the first 1000 commits of each side are listed.</div>
          {/if}
        </div>
        <div class="section-title files-title">Files that differ <span class="dim">({comparison.files.length})</span></div>
        <div class="files">
          <BranchFileList files={comparison.files} selectedPath={selected?.path ?? null} onselect={(file) => void select(file)} />
        </div>
      </div>
      <div class="diff">
        {#if diffError}
          <div class="placeholder dim selectable">{diffError}</div>
        {:else if diff && selected}
          {#key `${comparison.baseId}:${comparison.branchId}:${selected.path}`}
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
          <div class="placeholder dim">{comparison.files.length === 0 ? "The branches have the same files." : "Select a file"}</div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="placeholder dim">Loading...</div>
  {/if}
</div>

<style>
  .compare-tab {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--panel);
  }

  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 10px;
    border-bottom: 1px solid var(--border-strong);
  }

  .title {
    min-width: 0;
  }

  .spacer {
    flex: 1;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .side {
    flex: 0 0 360px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-strong);
  }

  .commits {
    flex: 0 1 50%;
    min-height: 60px;
    overflow-y: auto;
    border-bottom: 1px solid var(--border-strong);
  }

  .files {
    flex: 1;
    min-height: 60px;
    overflow-y: auto;
  }

  .section-title {
    padding: 6px 10px 3px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .commit {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 24px;
    padding: 0 10px;
    border: none;
    background: none;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .commit:hover {
    background: var(--hover);
  }

  .hash {
    flex: none;
    width: 64px;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .subject {
    flex: 1;
    min-width: 0;
  }

  .when {
    flex: none;
    font-size: 12px;
  }

  .none {
    padding: 2px 10px 6px;
    font-size: 12px;
  }

  .diff {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--editor-bg);
  }

  .placeholder {
    padding: 24px;
    text-align: center;
  }

  .spinner {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
