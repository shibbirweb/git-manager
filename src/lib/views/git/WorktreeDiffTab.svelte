<!-- Branches popup > Show Diff with Working Tree: the files that differ between a branch and
     the working copy, each with its diff (the branch on the left). Reloads when files change. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { joinPath } from "$lib/stores/workspacePaths";
  import { api, errorMessage } from "$lib/api";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { ChangedFile, RevisionDiff, WorktreeComparison } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
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

  $effect(() => {
    // A new status object means files changed on disk.
    void repoStore.statuses[repoRoot];
    void repoStore.historyVersion;
    void revision;
    untrack(() => void load());
  });

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
      }
    } catch (error) {
      if (token === diffToken) {
        result = null;
        diffError = errorMessage(error);
      }
    }
  }
</script>

<div class="worktree-tab">
  <div class="toolbar">
    <Icon name="git-compare" size={14} />
    <span class="title truncate"><strong>{revision}</strong> compared with the working tree</span>
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={() => void load()} title="Refresh">
      <Icon name="refresh" size={13} />
    </button>
  </div>
  {#if loadError}
    <div class="placeholder">
      <Icon name="alert" size={18} />
      <div>Could not compare {revision} with the working tree</div>
      <div class="dim selectable">{loadError}</div>
    </div>
  {:else if comparison}
    <div class="body">
      <div class="side">
        <div class="section-title">Files that differ <span class="dim">({comparison.files.length})</span></div>
        <BranchFileList files={comparison.files} selectedPath={selected?.path ?? null} onselect={(file) => void select(file)} />
      </div>
      <div class="diff">
        {#if diffError}
          <div class="placeholder dim selectable">{diffError}</div>
        {:else if result && selected}
          {#key `${comparison.commitId}:${selected.path}`}
            <DiffView
              diff={result.diff}
              path={selected.path}
              mode="readonly"
              leftLabel={revision}
              rightLabel="Working Tree"
              workingFile={{ filePath: joinPath(repoRoot, selected.path), sameLines: true }}
            />
          {/key}
        {:else}
          <div class="placeholder dim">{comparison.files.length === 0 ? "The working tree matches this branch." : "Select a file"}</div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="placeholder dim">Loading...</div>
  {/if}
</div>

<style>
  .worktree-tab {
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
    flex: 0 0 320px;
    min-width: 0;
    overflow-y: auto;
    border-right: 1px solid var(--border-strong);
  }

  .section-title {
    padding: 6px 10px 3px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
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
</style>
