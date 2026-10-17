<!-- One editor group's content: its tabs, the first group's diff, Log or start screen, and every tab's editor, kept
     mounted while another tab of the group shows (ElementHost hidden), so unsaved edits, cursor and scroll survive. -->
<script lang="ts">
  import ElementHost from "@nibtree/ui/components/ElementHost.svelte";
  import FileCompareTab from "$lib/compare/FileCompareTab.svelte";
  import { isCompareTab } from "$lib/compare/compareTabs";
  import CommitTab from "$lib/log/CommitTab.svelte";
  import { isBranchTab } from "$lib/stores/branchTabs";
  import { isCommitTab } from "$lib/stores/commitTabs";
  import type { EditorGroup } from "$lib/stores/editorGroups";
  import { isGitTab } from "$lib/stores/gitTabs";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { isUntitledTab } from "$lib/stores/untitledTabs";
  import TerminalSlot from "$lib/terminal/TerminalSlot.svelte";
  import { parseTerminalTabPath } from "$lib/terminal/terminalTabs";
  import ChangesDiff from "./changes/ChangesDiff.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import EditorTabs from "./EditorTabs.svelte";
  import EmptyMain from "./EmptyMain.svelte";
  import FileView from "./files/FileView.svelte";
  import UntitledView from "./files/UntitledView.svelte";
  import BranchTab from "./git/BranchTab.svelte";
  import GitTab from "./git/GitTab.svelte";
  import LogView from "./LogView.svelte";
  import NoRepository from "./NoRepository.svelte";

  let { group, index }: { group: EditorGroup; index: number } = $props();

  /** What the first editor group shows besides its tabs. */
  const primaryView = $derived(changesSelection.primaryView);
</script>

{#if (index === 0 && changesSelection.selected) || group.tabs.length > 0}
  <EditorTabs groupId={group.id} />
{/if}
{#if index === 0}
  {#if primaryView === "diff"}
    <ChangesDiff />
  {:else if primaryView === "log"}
    {#if repoStore.repo}
      <LogView />
    {:else}
      <NoRepository />
    {/if}
  {:else if primaryView === "none"}
    <EmptyMain />
  {/if}
{/if}
<!--
  Every tab keeps its editor mounted, so unsaved edits, cursor and scroll survive switching.
  A tab restored at start (dormant) gets its editor the first time it is shown.
-->
{#each group.tabs as tab (tab.path)}
  {@const terminalKey = parseTerminalTabPath(tab.path)}
  <ElementHost fill="grow" stretch label="Tab content" hidden={!changesSelection.tabShown(group.id, tab.path)}>
    {#if terminalKey !== null}
      <TerminalSlot {terminalKey} />
    {:else if isCommitTab(tab.path)}
      <CommitTab tabPath={tab.path} />
    {:else if isGitTab(tab.path)}
      <GitTab tabPath={tab.path} />
    {:else if isBranchTab(tab.path)}
      <BranchTab tabPath={tab.path} />
    {:else if isCompareTab(tab.path)}
      <FileCompareTab tabPath={tab.path} />
    {:else if isUntitledTab(tab.path)}
      <UntitledView tabPath={tab.path} groupId={group.id} />
    {:else if !repoStore.isDormant(tab.path, group.id)}
      <FileView filePath={tab.path} groupId={group.id} />
    {/if}
  </ElementHost>
{/each}
