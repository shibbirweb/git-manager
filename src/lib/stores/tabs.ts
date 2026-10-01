// Editor tabs with a VS Code / JetBrains style preview tab: a single click
// opens (or replaces) the one preview tab; double-clicking or editing pins it.

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

/** Tab labels: the file name, plus its folder when another tab has the same name. */
export function tabLabels(tabs: FileTab[]): Map<string, { name: string; hint: string | null }> {
  const counts = new Map<string, number>();
  const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  for (const tab of tabs) {
    counts.set(nameOf(tab.path), (counts.get(nameOf(tab.path)) ?? 0) + 1);
  }
  return new Map(
    tabs.map((tab) => {
      const name = nameOf(tab.path);
      const folder = tab.path.includes("/") ? tab.path.slice(0, tab.path.lastIndexOf("/")) : "";
      const duplicate = (counts.get(name) ?? 0) > 1;
      return [tab.path, { name, hint: duplicate ? folder.split("/").pop() || folder || null : null }];
    }),
  );
}
