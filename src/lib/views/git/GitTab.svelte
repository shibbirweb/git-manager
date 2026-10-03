<!-- A Git history, compare or reflog view in its own editor tab (see stores/gitTabs.ts). -->
<script lang="ts">
  import { parseGitTabPath } from "$lib/stores/gitTabs";
  import CompareTab from "./CompareTab.svelte";
  import FileHistoryTab from "./FileHistoryTab.svelte";
  import LineHistoryTab from "./LineHistoryTab.svelte";
  import ReflogTab from "./ReflogTab.svelte";
  import ShelfDiffTab from "$lib/shelf/ShelfDiffTab.svelte";

  interface Props {
    tabPath: string;
  }

  let { tabPath }: Props = $props();

  const ref = $derived(parseGitTabPath(tabPath));
</script>

{#if ref?.kind === "fileHistory"}
  <FileHistoryTab repoRoot={ref.repoRoot} filePath={ref.filePath} />
{:else if ref?.kind === "lineHistory"}
  <LineHistoryTab repoRoot={ref.repoRoot} filePath={ref.filePath} startLine={ref.startLine} endLine={ref.endLine} />
{:else if ref?.kind === "compare"}
  <CompareTab repoRoot={ref.repoRoot} filePath={ref.filePath} revision={ref.revision} />
{:else if ref?.kind === "shelf"}
  <ShelfDiffTab repoRoot={ref.repoRoot} filePath={ref.filePath} shelfId={ref.shelfId} />
{:else if ref?.kind === "reflog"}
  <ReflogTab repoRoot={ref.repoRoot} />
{/if}
