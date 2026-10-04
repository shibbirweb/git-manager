// Editor groups (Window > Split Right): the editor area holds one group of tabs,
// or two side by side. Each group has its own strip and active tab. Only file tabs may be open
// in both groups: a commit, Git, branch or terminal tab is one live view that cannot be shown
// twice. Group ids never change, so the editors of the right group stay mounted when the left
// group closes and the right one takes its place. Pure; repo.svelte.ts holds the state.

import { isPseudoTab } from "./pseudoTabs";
import { tabsToEvict } from "./tabLimit";
import { closeTabs, type FileTab, openTab, setTabDirty, type TabsState } from "./tabs";

/** Two groups side by side; more would leave too little room for code. */
export const MAX_GROUPS = 2;

export interface EditorGroup extends TabsState {
  id: number;
}

export interface GroupsState {
  /** Left to right; the first one also shows the Diff tab and the Log. */
  groups: EditorGroup[];
  /** Id of the group that has (or last had) the keyboard focus. */
  focused: number;
  /** The id the next new group gets. */
  nextId: number;
}

export interface GroupTab {
  groupId: number;
  tabPath: string;
}

export function initialGroups(): GroupsState {
  return { groups: [{ id: 0, tabs: [], active: null }], focused: 0, nextId: 1 };
}

export function groupById(state: GroupsState, groupId: number): EditorGroup | null {
  return state.groups.find((group) => group.id === groupId) ?? null;
}

/** The focused group; the first one when the focused id is stale. */
export function focusedGroup(state: GroupsState): EditorGroup {
  return groupById(state, state.focused) ?? state.groups[0];
}

/** With two groups, the one that is not `groupId`. */
export function otherGroup(state: GroupsState, groupId: number): EditorGroup | null {
  return state.groups.find((group) => group.id !== groupId) ?? null;
}

export function hasTab(group: TabsState, tabPath: string): boolean {
  return group.tabs.some((tab) => tab.path === tabPath);
}

/** Every open tab once, left group first: what the window has open, whatever the group. */
export function allTabs(state: GroupsState): FileTab[] {
  if (state.groups.length === 1) {
    return state.groups[0].tabs;
  }
  const seen = new Set<string>();
  const tabs: FileTab[] = [];
  for (const group of state.groups) {
    for (const tab of group.tabs) {
      if (!seen.has(tab.path)) {
        seen.add(tab.path);
        tabs.push(tab);
      }
    }
  }
  return tabs;
}

/** Tabs open in `before` that no group has in `after`: they really closed. */
export function closedBetween(before: GroupsState, after: GroupsState): FileTab[] {
  const open = new Set(allTabs(after).map((tab) => tab.path));
  return allTabs(before).filter((tab) => !open.has(tab.path));
}

/**
 * The group an open of `tabPath` goes to. A plain open shows the tab where it already is
 * (the focused group first), else in the focused group. `toSide` (Open to the Side) picks the
 * other group, or the id of the right group it would create.
 */
export function openTarget(state: GroupsState, tabPath: string, toSide = false): number {
  const focused = focusedGroup(state);
  if (toSide) {
    return otherGroup(state, focused.id)?.id ?? (state.groups.length < MAX_GROUPS ? state.nextId : focused.id);
  }
  if (hasTab(focused, tabPath)) {
    return focused.id;
  }
  return state.groups.find((group) => hasTab(group, tabPath))?.id ?? focused.id;
}

function withGroup(state: GroupsState, groupId: number, next: TabsState): GroupsState {
  return {
    ...state,
    groups: state.groups.map((group) => (group.id === groupId ? { id: group.id, tabs: next.tabs, active: next.active } : group)),
  };
}

/** Adds the right group when `groupId` is the next id and there is room. */
function ensureGroup(state: GroupsState, groupId: number): GroupsState {
  if (groupById(state, groupId) || groupId !== state.nextId || state.groups.length >= MAX_GROUPS) {
    return state;
  }
  return { ...state, groups: [...state.groups, { id: groupId, tabs: [], active: null }], nextId: state.nextId + 1 };
}

/** Removes a pseudo tab from every group but `groupId`, so it lives in one group only. */
function moveOutOfOthers(state: GroupsState, groupId: number, tabPath: string): GroupsState {
  if (!isPseudoTab(tabPath)) {
    return state;
  }
  let next = state;
  for (const group of state.groups) {
    if (group.id !== groupId && hasTab(group, tabPath)) {
      next = withGroup(next, group.id, closeTabs(group, [tabPath]));
    }
  }
  return next;
}

/**
 * Opens (or shows) `tabPath` in `groupId` and focuses that group. A new right group is made
 * when `groupId` is `nextId`; an unknown id means the focused group. `pin` as in openTab.
 */
export function openInGroup(state: GroupsState, groupId: number, tabPath: string, pin: boolean): GroupsState {
  const ensured = ensureGroup(state, groupId);
  const target = groupById(ensured, groupId) ?? focusedGroup(ensured);
  const moved = moveOutOfOthers(ensured, target.id, tabPath);
  const group = groupById(moved, target.id) ?? target;
  return { ...withGroup(moved, target.id, openTab(group, tabPath, pin)), focused: target.id };
}

/** Replaces one group's tabs and active tab. */
export function updateGroup(state: GroupsState, groupId: number, next: TabsState): GroupsState {
  const group = groupById(state, groupId);
  if (!group || (group.tabs === next.tabs && group.active === next.active)) {
    return state;
  }
  return withGroup(state, groupId, next);
}

/** Runs a tabs.ts change on every group; returns `state` itself when no group changed. */
export function mapGroups(state: GroupsState, change: (group: EditorGroup) => TabsState): GroupsState {
  let changed = false;
  const groups = state.groups.map((group) => {
    const next = change(group);
    if (next.tabs === group.tabs && next.active === group.active) {
      return group;
    }
    changed = true;
    return { id: group.id, tabs: next.tabs, active: next.active };
  });
  return changed ? { ...state, groups } : state;
}

/** Unsaved state belongs to the file, so every group's tab of it follows. */
export function setDirtyEverywhere(state: GroupsState, filePath: string, dirty: boolean): GroupsState {
  return mapGroups(state, (group) => setTabDirty(group, filePath, dirty));
}

/** Closes `tabPaths` in one group, or in every group when `groupId` is null. */
export function closeInGroups(state: GroupsState, tabPaths: string[], groupId: number | null): GroupsState {
  return mapGroups(state, (group) => {
    const own = groupId === null || group.id === groupId;
    return own && tabPaths.some((tabPath) => hasTab(group, tabPath)) ? closeTabs(group, tabPaths) : group;
  });
}

/**
 * Empty groups close, except the first one while `keepFirst` (it shows the Diff tab or the
 * Log) and the last group left. Focus moves to the neighbour of a closed focused group.
 */
export function dropEmptyGroups(state: GroupsState, keepFirst: boolean): GroupsState {
  const kept = state.groups.filter((group, index) => group.tabs.length > 0 || (index === 0 && keepFirst));
  if (kept.length === state.groups.length) {
    return state;
  }
  const groups = kept.length > 0 ? kept : [state.groups[0]];
  if (groups.some((group) => group.id === state.focused)) {
    return { ...state, groups };
  }
  const oldIndex = Math.max(
    0,
    state.groups.findIndex((group) => group.id === state.focused),
  );
  return { ...state, groups, focused: groups[Math.min(oldIndex, groups.length - 1)].id };
}

export function focusGroup(state: GroupsState, groupId: number): GroupsState {
  return state.focused !== groupId && groupById(state, groupId) ? { ...state, focused: groupId } : state;
}

/** Split Right: possible from the focused group's tab on screen, unless it already is the right group. */
export function canSplitRight(state: GroupsState, shownTab: string | null): boolean {
  return shownTab !== null && state.groups.findIndex((group) => group.id === state.focused) < MAX_GROUPS - 1;
}

/**
 * Split Right: the focused group's tab on screen also opens in the right group (a file) or
 * moves there (a commit, Git, branch or terminal tab), and the right group takes the focus.
 */
export function splitRight(state: GroupsState, shownTab: string | null): GroupsState {
  if (!canSplitRight(state, shownTab) || shownTab === null) {
    return state;
  }
  const right = otherGroup(state, state.focused)?.id ?? state.nextId;
  return openInGroup(state, right, shownTab, true);
}

/** Move Tab to Other Group: out of `groupId` into the other group, made when there is none. */
export function moveToOtherGroup(state: GroupsState, groupId: number, tabPath: string): GroupsState {
  const source = groupById(state, groupId);
  if (!source || !hasTab(source, tabPath)) {
    return state;
  }
  const target = otherGroup(state, groupId)?.id ?? (state.groups.length < MAX_GROUPS ? state.nextId : null);
  if (target === null) {
    return state;
  }
  const tab = source.tabs.find((candidate) => candidate.path === tabPath) as FileTab;
  const closed = withGroup(state, groupId, closeTabs(source, [tabPath]));
  const opened = openInGroup(closed, target, tabPath, true);
  // The moved tab keeps its flags, unsaved edits included.
  return mapGroups(opened, (group) =>
    group.id === target
      ? { ...group, tabs: group.tabs.map((candidate) => (candidate.path === tabPath ? { ...tab, preview: false } : candidate)) }
      : group,
  );
}

/** Close Group: the group goes with its tabs (a tab also open in the other group stays there). */
export function closeGroup(state: GroupsState, groupId: number): GroupsState {
  if (state.groups.length < 2 || !groupById(state, groupId)) {
    return state;
  }
  const groups = state.groups.filter((group) => group.id !== groupId);
  return { ...state, groups, focused: state.focused === groupId ? groups[0].id : state.focused };
}

/** Setting turned off: one group with every tab, the focused group's tab on screen. */
export function mergeGroups(state: GroupsState): GroupsState {
  if (state.groups.length < 2) {
    return state;
  }
  const [first] = state.groups;
  const tabs = allTabs(state);
  return { ...state, groups: [{ id: first.id, tabs, active: focusedGroup(state).active ?? first.active }], focused: first.id };
}

const keyOf = (groupId: number, tabPath: string) => `${groupId}\n${tabPath}`;

/**
 * The tab limit over both groups: every group's tab counts, the least recently used close
 * first. A group's tab on screen and `keep` (the tab just opened) never close, so a group
 * never empties this way and single tab mode keeps one tab per group.
 */
export function groupEvictions(
  state: GroupsState,
  lastUsed: ReadonlyMap<string, number>,
  limit: number,
  keep: GroupTab | null,
  isFile: (tabPath: string) => boolean,
): GroupTab[] {
  const entries = state.groups.flatMap((group) =>
    group.tabs.map((tab) => ({
      path: keyOf(group.id, tab.path),
      dirty: tab.dirty,
      pinned: tab.pinned === true || tab.path === group.active,
      groupId: group.id,
      tabPath: tab.path,
    })),
  );
  const byKey = new Map(entries.map((entry) => [entry.path, entry]));
  const used = new Map<string, number>();
  for (const entry of entries) {
    const stamp = lastUsed.get(entry.tabPath);
    if (stamp !== undefined) {
      used.set(entry.path, stamp);
    }
  }
  const evict = tabsToEvict(entries, used, limit, keep ? keyOf(keep.groupId, keep.tabPath) : null, (key) =>
    isFile(byKey.get(key)?.tabPath ?? ""),
  );
  return evict.map((key) => {
    const entry = byKey.get(key) as (typeof entries)[number];
    return { groupId: entry.groupId, tabPath: entry.tabPath };
  });
}

/** Closes the evicted tabs, each in its own group. */
export function applyEvictions(state: GroupsState, evictions: readonly GroupTab[]): GroupsState {
  if (evictions.length === 0) {
    return state;
  }
  return mapGroups(state, (group) => {
    const paths = evictions.filter((entry) => entry.groupId === group.id).map((entry) => entry.tabPath);
    return paths.length > 0 ? closeTabs(group, paths) : group;
  });
}

/** Index (0 left, 1 right) of the group holding `tabPath`, the focused one first; -1 when none does. */
export function sideOf(state: GroupsState, tabPath: string): number {
  const focusedIndex = state.groups.findIndex((group) => group.id === state.focused);
  if (focusedIndex >= 0 && hasTab(state.groups[focusedIndex], tabPath)) {
    return focusedIndex;
  }
  return state.groups.findIndex((group) => hasTab(group, tabPath));
}

/** Two restored groups as one state; an empty right group means no split. */
export function restoredGroups(left: TabsState, right: TabsState | null, rightFocused: boolean): GroupsState {
  if (!right || right.tabs.length === 0) {
    return { groups: [{ id: 0, tabs: left.tabs, active: left.active }], focused: 0, nextId: 1 };
  }
  if (left.tabs.length === 0) {
    return { groups: [{ id: 0, tabs: right.tabs, active: right.active }], focused: 0, nextId: 1 };
  }
  return {
    groups: [
      { id: 0, tabs: left.tabs, active: left.active },
      { id: 1, tabs: right.tabs, active: right.active },
    ],
    focused: rightFocused ? 1 : 0,
    nextId: 2,
  };
}
