// Editor tabs with a VS Code / JetBrains style preview tab: a single click
// opens (or replaces) the one preview tab; double-clicking or editing pins it.

import { isTerminalTab } from "$lib/terminal/terminalTabs";
import { commitTabsInFolder, parseCommitTabPath } from "./commitTabs";
import { branchTabsInFolder, branchTabTitle, parseBranchTabPath } from "./branchTabs";
import { gitTabsInFolder, gitTabTitle, parseGitTabPath } from "./gitTabs";
import { isPseudoTab } from "./pseudoTabs";
import { movedPath, pathsUnder, type PathMove } from "./workspacePaths";

export interface FileTab {
  /** Absolute path (see workspacePaths.ts). */
  path: string;
  /** Preview tabs are shown in italics and replaced by the next single-click open. */
  preview: boolean;
  dirty: boolean;
}

export interface TabsState {
  tabs: FileTab[];
  active: string | null;
}

/** Opens `path`: activates an existing tab, reuses the preview tab, or appends a new one. */
export function openTab(state: TabsState, path: string, pin: boolean): TabsState {
  const existing = state.tabs.find((tab) => tab.path === path);
  if (existing) {
    const tabs = pin && existing.preview ? state.tabs.map((tab) => (tab.path === path ? { ...tab, preview: false } : tab)) : state.tabs;
    return { tabs, active: path };
  }
  const opened: FileTab = { path, preview: !pin, dirty: false };
  const previewIndex = state.tabs.findIndex((tab) => tab.preview && !tab.dirty);
  if (previewIndex >= 0) {
    const tabs = state.tabs.slice();
    tabs[previewIndex] = opened;
    return { tabs, active: path };
  }
  // A new tab goes right after the active one, as editors do.
  const activeIndex = state.tabs.findIndex((tab) => tab.path === state.active);
  const tabs = state.tabs.slice();
  tabs.splice(activeIndex >= 0 ? activeIndex + 1 : tabs.length, 0, opened);
  return { tabs, active: path };
}

export function pinTab(state: TabsState, path: string): TabsState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.path === path && tab.preview ? { ...tab, preview: false } : tab)),
  };
}

/** Editing a file pins its tab so the next single-click does not replace it. */
export function setTabDirty(state: TabsState, path: string, dirty: boolean): TabsState {
  const tab = state.tabs.find((candidate) => candidate.path === path);
  if (!tab || (tab.dirty === dirty && (!dirty || !tab.preview))) {
    return state;
  }
  return {
    ...state,
    tabs: state.tabs.map((candidate) =>
      candidate.path === path ? { ...candidate, dirty, preview: dirty ? false : candidate.preview } : candidate,
    ),
  };
}

/** Closes the given tabs; the active tab moves to its right neighbour, else the left one. */
export function closeTabs(state: TabsState, paths: string[]): TabsState {
  const closing = new Set(paths);
  const tabs = state.tabs.filter((tab) => !closing.has(tab.path));
  if (!state.active || !closing.has(state.active)) {
    return { tabs, active: state.active };
  }
  const oldIndex = state.tabs.findIndex((tab) => tab.path === state.active);
  const right = state.tabs.slice(oldIndex + 1).find((tab) => !closing.has(tab.path));
  const left = state.tabs
    .slice(0, oldIndex)
    .reverse()
    .find((tab) => !closing.has(tab.path));
  return { tabs, active: right?.path ?? left?.path ?? null };
}

export function pathsToRight(state: TabsState, path: string): string[] {
  const index = state.tabs.findIndex((tab) => tab.path === path);
  return index < 0 ? [] : state.tabs.slice(index + 1).map((tab) => tab.path);
}

export function otherPaths(state: TabsState, path: string): string[] {
  return state.tabs.filter((tab) => tab.path !== path).map((tab) => tab.path);
}

/**
 * Next Tab (step 1) / Previous Tab (step -1), wrapping around. With no tab on screen
 * (`activePath` null) it starts from the first or the last tab.
 */
export function adjacentTab(tabs: FileTab[], activePath: string | null, step: 1 | -1): string | null {
  if (tabs.length === 0) {
    return null;
  }
  const index = activePath === null ? -1 : tabs.findIndex((tab) => tab.path === activePath);
  if (index < 0) {
    return tabs[step === 1 ? 0 : tabs.length - 1].path;
  }
  return tabs[(index + step + tabs.length) % tabs.length].path;
}

/** Name of a terminal tab whose terminal is not known (any more); the tab strip shows the terminal's own name. */
export const TERMINAL_TAB_LABEL = "Terminal";

/**
 * Tab labels: the file name, plus its folder when another tab has the same
 * name. A commit tab (see commitTabs.ts) is labelled with its short hash; a
 * terminal tab gets a placeholder, since only the terminal store knows its name.
 */
export function tabLabels(tabs: FileTab[]): Map<string, { name: string; hint: string | null }> {
  const counts = new Map<string, number>();
  const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  for (const tab of tabs) {
    if (!isPseudoTab(tab.path)) {
      counts.set(nameOf(tab.path), (counts.get(nameOf(tab.path)) ?? 0) + 1);
    }
  }
  return new Map(
    tabs.map((tab) => {
      const commit = parseCommitTabPath(tab.path);
      if (commit) {
        return [tab.path, { name: commit.commitId.slice(0, 8), hint: null }];
      }
      const gitTab = parseGitTabPath(tab.path);
      if (gitTab) {
        return [tab.path, { name: gitTabTitle(gitTab).name, hint: null }];
      }
      const branchTab = parseBranchTabPath(tab.path);
      if (branchTab) {
        return [tab.path, { name: branchTabTitle(branchTab).name, hint: null }];
      }
      if (isTerminalTab(tab.path)) {
        return [tab.path, { name: TERMINAL_TAB_LABEL, hint: null }];
      }
      const name = nameOf(tab.path);
      const folder = tab.path.includes("/") ? tab.path.slice(0, tab.path.lastIndexOf("/")) : "";
      const duplicate = (counts.get(name) ?? 0) > 1;
      return [tab.path, { name, hint: duplicate ? folder.split("/").pop() || folder || null : null }];
    }),
  );
}

/**
 * Tabs that close with a workspace folder: its files and the commit and Git
 * tabs of its repositories. Terminal tabs stay, like terminals in the panel.
 */
export function tabsInFolder(tabPaths: string[], folderRoot: string): string[] {
  const prefix = folderRoot.endsWith("/") ? folderRoot : `${folderRoot}/`;
  const commits = new Set([
    ...commitTabsInFolder(tabPaths, folderRoot),
    ...gitTabsInFolder(tabPaths, folderRoot),
    ...branchTabsInFolder(tabPaths, folderRoot),
  ]);
  return tabPaths.filter((tabPath) => commits.has(tabPath) || (!isPseudoTab(tabPath) && tabPath.startsWith(prefix)));
}

/** File tabs (never pseudo tabs) of `entryPaths` or of files inside those folders. */
export function fileTabsUnder(tabPaths: string[], entryPaths: string[]): string[] {
  return pathsUnder(
    tabPaths.filter((tabPath) => !isPseudoTab(tabPath)),
    entryPaths,
  );
}

/**
 * Files were renamed or moved: their tabs, and the tabs of files inside a moved folder,
 * point at the new paths in place, keeping order, preview and dirty state. Returns `state`
 * itself when no tab moved.
 */
export function retargetTabs(state: TabsState, moves: PathMove[]): TabsState {
  const target = (tabPath: string) => (isPseudoTab(tabPath) ? tabPath : movedPath(tabPath, moves));
  if (!state.tabs.some((tab) => target(tab.path) !== tab.path)) {
    return state;
  }
  const seen = new Set<string>();
  const tabs: FileTab[] = [];
  for (const tab of state.tabs) {
    const path = target(tab.path);
    // A tab already open on the new path wins; the moved one folds into it.
    if (!seen.has(path)) {
      seen.add(path);
      tabs.push(path === tab.path ? tab : { ...tab, path });
    }
  }
  return { tabs, active: state.active === null ? null : target(state.active) };
}
