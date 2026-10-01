<!-- A commit in its own editor tab: the same details as the Log pane, with the whole editor area for the diff. -->
<script lang="ts">
  import { parseCommitTabPath } from "$lib/stores/commitTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import CommitDetails from "./CommitDetails.svelte";

  interface Props {
    tabPath: string;
  }

  let { tabPath }: Props = $props();

  const ref = $derived(parseCommitTabPath(tabPath));
  const preferredFile = $derived.by(() => {
    const focus = repoStore.commitTabs[tabPath]?.focus ?? null;
    return ref && focus ? { commitId: ref.commitId, path: focus.path, line: null, token: focus.token } : null;
  });

  /** The tab shows any commit, loaded in the Log or not, so parents are always clickable. */
  function shortId(commitId: string): string {
    return commitId.slice(0, 8);
  }

  function openParent(parentId: string): void {
    if (ref) {
      repoStore.openCommitTab(ref.repoRoot, parentId);
    }
  }
</script>

<div class="commit-tab">
  {#if ref}
    <CommitDetails repoPath={ref.repoRoot} commitId={ref.commitId} loadedShortId={shortId} onSelectCommit={openParent} {preferredFile} />
  {/if}
</div>

<style>
  .commit-tab {
    flex: 1;
    display: flex;
    min-height: 0;
    min-width: 0;
  }
</style>
