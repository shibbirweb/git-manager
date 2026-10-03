<!-- A Branches popup view in its own editor tab (see stores/branchTabs.ts). -->
<script lang="ts">
  import { parseBranchTabPath } from "$lib/stores/branchTabs";
  import BranchCompareTab from "./BranchCompareTab.svelte";
  import ChangesTab from "./ChangesTab.svelte";
  import WorktreeDiffTab from "./WorktreeDiffTab.svelte";

  interface Props {
    tabPath: string;
  }

  let { tabPath }: Props = $props();

  const ref = $derived(parseBranchTabPath(tabPath));
</script>

{#if ref?.kind === "compare"}
  <BranchCompareTab repoRoot={ref.repoRoot} branchName={ref.branchName} baseName={ref.baseName} />
{:else if ref?.kind === "worktree"}
  <WorktreeDiffTab repoRoot={ref.repoRoot} revision={ref.revision} />
{:else if ref?.kind === "changes"}
  <ChangesTab repoRoot={ref.repoRoot} />
{/if}
