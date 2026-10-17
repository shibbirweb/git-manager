<!--
  Tab bar of one editor group: the first group's strip starts with the Diff tab, then every
  file, commit and terminal tab open in that group, pinned tabs first. Tabs reorder by drag
  and, with Settings > Editor > Wrap tabs, wrap onto more rows instead of scrolling. In single
  tab mode with Single tab title on, a strip holding one tab shows it as a centered name.
-->
<script lang="ts">
  import TabStrip from "@nibtree/ui/components/TabStrip.svelte";
  import { startMenu } from "$lib/ai/sessions.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { showsTabAsTitle, tabLabels } from "$lib/stores/tabs";
  import { terminalStore } from "$lib/terminal/terminalStore.svelte";
  import { parseTerminalTabPath } from "$lib/terminal/terminalTabs";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { changesSelection } from "./changes/selection.svelte";
  import { DIFF_TAB_ID, diffTabData, editorTabData } from "./editorTabInfo";
  import { openTabMenu } from "./editorTabMenu";

  let { groupId }: { groupId: number } = $props();

  const group = $derived(repoStore.groupById(groupId));
  const tabs = $derived(group?.tabs ?? []);
  /** The first group: it has the Diff tab. */
  const primary = $derived(repoStore.primaryGroupId === groupId);
  const split = $derived(repoStore.groups.length > 1);
  /** With several groups, the strips of the unfocused ones are dimmed. */
  const focused = $derived(!split || repoStore.focusedGroupId === groupId);
  const diffTab = $derived(primary && changesSelection.selected ? diffTabData(changesSelection.selected) : null);
  const labels = $derived(tabLabels(tabs));
  const stripTabs = $derived([
    ...(diffTab ? [diffTab] : []),
    ...tabs.map((tab) => editorTabData(tab, labels.get(tab.path))),
  ]);
  const active = $derived.by(() => {
    if (primary && changesSelection.primaryView === "diff") {
      return DIFF_TAB_ID;
    }
    return tabs.find((tab) => changesSelection.tabShown(groupId, tab.path))?.path ?? null;
  });
  /** The worktree of the agent this group shows, for the + after the tabs: a new agent or terminal there. */
  const agentFolder = $derived.by(() => {
    const terminalKey = group?.active ? parseTerminalTabPath(group.active) : null;
    return terminalKey !== null ? (terminalStore.find(terminalKey)?.agent?.folderPath ?? null) : null;
  });
  const agentFolderName = $derived(agentFolder ? agentFolder.slice(agentFolder.lastIndexOf("/") + 1) : "");
  const single = $derived(
    showsTabAsTitle(
      settings.singleTabTitle,
      settings.tabLimit,
      tabs.length,
      primary && changesSelection.selected !== null,
    ),
  );
  const label = $derived(
    split
      ? `Open editors, group ${repoStore.groups.findIndex((candidate) => candidate.id === groupId) + 1}`
      : "Open editors",
  );

  function select(tabId: string): void {
    if (tabId === DIFF_TAB_ID) {
      repoStore.view = "diff";
    } else {
      repoStore.activateTab(groupId, tabId);
    }
  }

  function close(tabId: string): void {
    if (tabId === DIFF_TAB_ID) {
      changesSelection.close();
    } else {
      void repoStore.closeTab(tabId, groupId);
    }
  }

  function openMenu(tabId: string, event: MouseEvent): void {
    const tab = tabs.find((candidate) => candidate.path === tabId);
    if (tab) {
      openTabMenu(event, tab, groupId);
    }
  }

  /** A dragged tab lands at `to`; the Diff tab stays first and is not one of the group's tabs. */
  function reorder(from: number, to: number): void {
    const offset = diffTab ? 1 : 0;
    const index = from - offset;
    const target = Math.max(0, to - offset);
    const tab = tabs[index];
    if (!tab) {
      return;
    }
    // The store counts gaps between the tabs as they were: past the tab's own place, one more.
    repoStore.moveTab(groupId, tab.path, target > index ? target + 1 : target);
    // The dragged tab comes to the front, as a press on it would.
    repoStore.activateTab(groupId, tab.path);
  }

  function newInFolder(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement | null;
    if (agentFolder && button) {
      repoStore.focusGroup(groupId);
      contextMenu.openBelow(button, startMenu(agentFolder));
    }
  }
</script>

<TabStrip
  {label}
  tabs={stripTabs}
  bind:active={() => active, () => {}}
  {focused}
  layout={single ? "single" : settings.wrapTabs ? "wrap" : "scroll"}
  look={settings.roundedPanels ? "rounded" : "flat"}
  newLabel="New agent or terminal in {agentFolderName}"
  onselect={select}
  ondblclick={(tabId) => tabId !== DIFF_TAB_ID && repoStore.pinFile(tabId, groupId)}
  onclose={close}
  onunpin={(tabId) => repoStore.setTabPinned(tabId, false)}
  oncontextmenu={openMenu}
  onnew={agentFolder ? newInFolder : undefined}
  onreorder={reorder}
/>
