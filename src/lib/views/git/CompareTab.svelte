<!-- Compare with Revision / Compare with Branch: the file at a revision (left) against the
     working copy on disk (right), read-only. Reloads when the repository's status changes. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { joinPath } from "$lib/stores/workspacePaths";
  import DiffView from "$lib/diff/DiffView.svelte";
  import { revisionLabel } from "$lib/stores/gitTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { RevisionDiff } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";

  interface Props {
    repoRoot: string;
    filePath: string;
    revision: string;
  }

  let { repoRoot, filePath, revision }: Props = $props();

  let result = $state.raw<RevisionDiff | null>(null);
  let loadError = $state<string | null>(null);
  let loadToken = 0;

  const label = $derived(revisionLabel(revision));
  const leftLabel = $derived(
    result && /^[0-9a-f]{40,64}$/i.test(revision) ? label : `${label} (${result?.commitId.slice(0, 8) ?? ""})`,
  );

  $effect(() => {
    // A new status object means files changed on disk.
    void repoStore.statuses[repoRoot];
    void load(repoRoot, filePath, revision);
  });

  async function load(targetRoot: string, targetPath: string, targetRevision: string): Promise<void> {
    const token = ++loadToken;
    try {
      const next = await api.compareWithRevision(targetRoot, targetPath, targetRevision);
      if (token === loadToken) {
        result = next;
        loadError = null;
      }
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
      }
    }
  }
</script>

<div class="compare-tab">
  {#if loadError}
    <div class="placeholder">
      <Icon name="alert" size={18} />
      <div>Could not compare with {label}</div>
      <div class="dim selectable">{loadError}</div>
    </div>
  {:else if result}
    {#if !result.existsInRevision}
      <div class="note dim">{filePath} does not exist in {label}: everything shows as added.</div>
    {/if}
    <DiffView
      diff={result.diff}
      path={filePath}
      mode="readonly"
      {leftLabel}
      rightLabel="Working Copy"
      workingFile={{ filePath: joinPath(repoRoot, filePath), sameLines: true }}
    />
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
    background: var(--editor-bg);
  }

  .note {
    flex: none;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel-alt);
    font-size: 12px;
  }

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
  }
</style>
