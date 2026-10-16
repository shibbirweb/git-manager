<!-- Compare with Revision / Compare with Branch: the file at a revision (left) against the
     working copy on disk (right), read-only. Reloads when the repository's status changes. -->
<script lang="ts">
  import { api, errorMessage } from "$lib/api";
  import { joinPath } from "$lib/stores/workspacePaths";
  import type { PreviewSides } from "$lib/diff/binaryPreview";
  import GitDiffView from "$lib/diff/GitDiffView.svelte";
  import { revisionLabel } from "$lib/stores/gitTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { RevisionDiff } from "$lib/types";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import Notice from "@git-manager/ui/components/Notice.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";

  interface Props {
    repoRoot: string;
    filePath: string;
    revision: string;
  }

  let { repoRoot, filePath, revision }: Props = $props();

  let result = $state.raw<RevisionDiff | null>(null);
  let loadError = $state<string | null>(null);
  let loadToken = 0;
  /** Bumped on every load, so a binary preview reads the work tree file again. */
  let previewVersion = $state(0);

  const label = $derived(revisionLabel(revision));
  const leftLabel = $derived(
    result && /^[0-9a-f]{40,64}$/i.test(revision) ? label : `${label} (${result?.commitId.slice(0, 8) ?? ""})`,
  );

  /** The revision (none when the file is not in it) against the work tree. */
  const previewSides = $derived.by((): PreviewSides | null => {
    if (!result) {
      return null;
    }
    return {
      original: result.existsInRevision ? { kind: "revision", repoRoot, revision: result.commitId, filePath } : null,
      modified: { kind: "worktree", filePath: joinPath(repoRoot, filePath) },
      version: previewVersion,
    };
  });

  $effect(() => {
    // A new status object means files changed on disk; the file version also covers an edit
    // that leaves the status as it was.
    void repoStore.statuses[repoRoot];
    void repoStore.fileVersions[repoRoot];
    void load(repoRoot, filePath, revision);
  });

  async function load(targetRoot: string, targetPath: string, targetRevision: string): Promise<void> {
    const token = ++loadToken;
    try {
      const next = await api.compareWithRevision(targetRoot, targetPath, targetRevision);
      if (token === loadToken) {
        result = next;
        loadError = null;
        previewVersion++;
      }
    } catch (error) {
      if (token === loadToken) {
        loadError = errorMessage(error);
      }
    }
  }
</script>

<Stack gap="none" grow surface="editor">
  {#if loadError}
    <EmptyState icon="alert" title="Could not compare with {label}" hint={loadError} />
  {:else if result}
    {#if !result.existsInRevision}
      <Notice variant="banner">{filePath} does not exist in {label}: everything shows as added.</Notice>
    {/if}
    <GitDiffView
      source={{ kind: "revisions", repoRoot, filePath, origPath: null, from: result.commitId, to: null }}
      diff={result.diff}
      path={filePath}
      labels={{ left: leftLabel, right: "Working Copy" }}
      blame={{ repoRoot, filePath, revision: null }}
      {previewSides}
    />
  {:else}
    <EmptyState title="Loading..." delayed />
  {/if}
</Stack>
