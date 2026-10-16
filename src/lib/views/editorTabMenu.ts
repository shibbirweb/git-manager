// An editor tab's context menu: keep open, pin, the Close items, the split editor's group moves, then what to copy
// or do for that kind of tab. Close Others, Close to the Right and Close All leave pinned tabs open.
import { errorMessage } from "$lib/api";
import { compareStore } from "$lib/compare/compareStore.svelte";
import { isCompareTab } from "$lib/compare/compareTabs";
import { localHistory } from "$lib/localHistory/localHistory.svelte";
import { parseBranchTabPath } from "$lib/stores/branchTabs";
import { parseCommitTabPath } from "$lib/stores/commitTabs";
import { parseGitTabPath } from "$lib/stores/gitTabs";
import { type GroupDirection, groupDirection, type SplitDirection } from "$lib/stores/groupLayout";
import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { repoStore } from "$lib/stores/repo.svelte";
import { settings } from "$lib/stores/settings.svelte";
import { type FileTab, otherPaths, pathsToRight, unpinnedPaths } from "$lib/stores/tabs";
import { isUntitledTab } from "$lib/stores/untitledTabs";
import { folderFor, relativeTo } from "$lib/stores/workspacePaths";
import { terminalStore } from "$lib/terminal/terminalStore.svelte";
import { parseTerminalTabPath } from "$lib/terminal/terminalTabs";
import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { moveEditorTab, splitEditor } from "./workspaceActions";

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch (error) {
    toast.error("Could not copy", errorMessage(error));
  }
}

/** The items after the Close ones: what to copy, or what to do with a terminal. */
function tabItems(filePath: string): MenuItem[] {
  const terminalKey = parseTerminalTabPath(filePath);
  if (terminalKey !== null) {
    return terminalStore.tabMenuItems(terminalKey);
  }
  const commit = parseCommitTabPath(filePath);
  if (commit) {
    return [{ label: "Copy Commit Hash", action: () => void copy(commit.commitId) }];
  }
  if (parseBranchTabPath(filePath) || isCompareTab(filePath) || isUntitledTab(filePath)) {
    return [];
  }
  const gitTab = parseGitTabPath(filePath);
  if (gitTab) {
    return gitTab.kind === "reflog" ? [] : [{ label: "Copy Relative Path", action: () => void copy(gitTab.filePath) }];
  }
  return [
    { label: "Show Local History", action: () => localHistory.openFile(filePath) },
    { separator: true },
    { label: "Copy Path", action: () => void copy(filePath) },
    {
      label: "Copy Relative Path",
      action: () => {
        const folder = folderFor(repoStore.workspace?.folders ?? [], filePath);
        void copy(folder ? relativeTo(folder.root, filePath) : filePath);
      },
    },
    ...compareStore.fileTabItems(filePath),
  ];
}

/** "Move to Right Group" names the group a tab moves to while there are at most two. */
function moveLabel(groupId: number): string {
  const target = repoStore.moveTargetFor(groupId);
  if (repoStore.groups.length > 2) {
    return "Move to Next Group";
  }
  const direction = repoStore.groups.length === 2 ? groupDirection(repoStore.groupLayout, groupId, target) : "right";
  const names: Record<GroupDirection, string> = { left: "Left", right: "Right", up: "Top", down: "Bottom" };
  return `Move to ${names[direction ?? "right"]} Group`;
}

/** Split Right and Split Down, the move to another group and Close Group, while the split editor setting is on. */
function groupItems(filePath: string, groupId: number): MenuItem[] {
  if (!settings.splitEditor) {
    return [];
  }
  const items: MenuItem[] = [];
  if (!isPseudoTab(filePath)) {
    // Focus only: this group keeps the file it shows, the clicked tab opens in the new group.
    const splitTo = (direction: SplitDirection) => {
      repoStore.focusGroup(groupId);
      splitEditor(filePath, direction);
    };
    const disabled = !repoStore.canSplit(filePath);
    items.push({ label: "Split Right", disabled, action: () => splitTo("right") });
    items.push({ label: "Split Down", disabled, action: () => splitTo("down") });
  }
  items.push({ label: moveLabel(groupId), action: () => moveEditorTab(filePath, groupId) });
  if (repoStore.groups.length > 1) {
    items.push({ label: "Close Group", action: () => void repoStore.closeGroup(groupId) });
  }
  return [...items, { separator: true }];
}

export function openTabMenu(event: MouseEvent, tab: FileTab, groupId: number): void {
  const group = repoStore.groupById(groupId);
  const tabs = group?.tabs ?? [];
  const filePath = tab.path;
  const pinned = repoStore.isPinned(filePath);
  const state = { tabs, active: group?.active ?? null };
  contextMenu.open(event, [
    ...(tab.preview ? [{ label: "Keep Open", action: () => repoStore.pinFile(filePath, groupId) }] : []),
    { label: pinned ? "Unpin Tab" : "Pin Tab", action: () => repoStore.setTabPinned(filePath, !pinned) },
    { separator: true },
    { label: "Close", action: () => void repoStore.closeTab(filePath, groupId) },
    {
      label: "Close Others",
      disabled: otherPaths(state, filePath).length === 0,
      action: () => void repoStore.closeOtherTabs(filePath, groupId),
    },
    {
      label: "Close to the Right",
      disabled: pathsToRight(state, filePath).length === 0,
      action: () => void repoStore.closeTabsToRight(filePath, groupId),
    },
    {
      label: "Close All",
      disabled: unpinnedPaths(tabs).length === 0,
      action: () => void repoStore.closeAllTabs(groupId),
    },
    { separator: true },
    ...groupItems(filePath, groupId),
    ...tabItems(filePath),
  ]);
}
