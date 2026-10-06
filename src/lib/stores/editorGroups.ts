// Editor groups (Window > Split Right / Split Down): the editor area holds one group of tabs,
// or several arranged by a split tree (groupLayout.ts), like JetBrains. Each group has its own
// strip and active tab. Only file tabs may be open in several groups: a commit, Git, branch or
// terminal tab is one live view that cannot be shown twice. Group ids never change, so a
// group's editors stay mounted when another group closes and it takes the room. Pure;
// repo.svelte.ts holds the state.

import {
  type GroupLayout,
  keepInLayout,
  layoutGroupIds,
  leafLayout,
  MAX_GROUPS,
  parseGroupLayout,
  rowLayout,
  type SplitDirection,
  setSplitRatio,
  splitLayout,
} from "./groupLayout";
import { isPseudoTab } from "./pseudoTabs";
import { tabsToEvict } from "./tabLimit";
import { closeTabs, type FileTab, openTab, setTabDirty, type TabsState } from "./tabs";

export interface EditorGroup extends TabsState {
  id: number;
}

export interface GroupsState {
  /** In layout order (left to right, top to bottom); the first one also shows the Diff tab and the Log. */
  groups: EditorGroup[];
  /** Where each group sits; its leaves are exactly the groups. */
  layout: GroupLayout;
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
  return { groups: [{ id: 0, tabs: [], active: null }], layout: leafLayout(0), focused: 0, nextId: 1 };
}

export function groupById(state: GroupsState, groupId: number): EditorGroup | null {
  return state.groups.find((group) => group.id === groupId) ?? null;
}

/** The focused group; the first one when the focused id is stale. */
export function focusedGroup(state: GroupsState): EditorGroup {
  return groupById(state, state.focused) ?? state.groups[0];
}

/** The group after `groupId` in layout order, going round; null with one group. */
export function otherGroup(state: GroupsState, groupId: number): EditorGroup | null {
  if (state.groups.length < 2) {
    return null;
  }
  const index = state.groups.findIndex((group) => group.id === groupId);
  return state.groups[(index + 1) % state.groups.length] ?? null;
}

/** `state` with a new layout, the groups put in its order (groups it lacks are dropped). */
function withLayout(state: GroupsState, layout: GroupLayout): GroupsState {
  const byId = new Map(state.groups.map((group) => [group.id, group]));
  const groups = layoutGroupIds(layout)
    .map((groupId) => byId.get(groupId))
    .filter((group): group is EditorGroup => group !== undefined);
  return { ...state, layout, groups };
}

export function hasTab(group: TabsState, tabPath: string): boolean {
  return group.tabs.some((tab) => tab.path === tabPath);
}

/** Every open tab once, first group first: what the window has open, whatever the group. */
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
 * next group, or the id of the group a split to the right would create.
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

/**
 * Adds group `groupId` when it is the next id and there is room, by splitting `anchorId`
 * (the focused group by default) in `direction`.
 */
function ensureGroup(state: GroupsState, groupId: number, direction: SplitDirection, anchorId = state.focused): GroupsState {
  if (groupById(state, groupId) || groupId !== state.nextId || state.groups.length >= MAX_GROUPS) {
    return state;
  }
  const anchor = groupById(state, anchorId) ?? focusedGroup(state);
  const added = { ...state, groups: [...state.groups, { id: groupId, tabs: [], active: null }], nextId: state.nextId + 1 };
  return withLayout(added, splitLayout(state.layout, anchor.id, groupId, direction));
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
 * Opens (or shows) `tabPath` in `groupId` and focuses that group. When `groupId` is `nextId`
 * the focused group splits in `direction` to make it; an unknown id means the focused group.
 * `pin` as in openTab.
 */
export function openInGroup(
  state: GroupsState,
  groupId: number,
  tabPath: string,
  pin: boolean,
  direction: SplitDirection = "right",
): GroupsState {
  const ensured = ensureGroup(state, groupId, direction);
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
  const layout = keepInLayout(state.layout, new Set(groups.map((group) => group.id))) ?? leafLayout(groups[0].id);
  if (groups.some((group) => group.id === state.focused)) {
    return withLayout(state, layout);
  }
  const oldIndex = Math.max(
    0,
    state.groups.findIndex((group) => group.id === state.focused),
  );
  return { ...withLayout(state, layout), focused: groups[Math.min(oldIndex, groups.length - 1)].id };
}

export function focusGroup(state: GroupsState, groupId: number): GroupsState {
  return state.focused !== groupId && groupById(state, groupId) ? { ...state, focused: groupId } : state;
}

/** Split Right / Split Down: possible with a tab on screen while there is room for another group. */
export function canSplit(state: GroupsState, shownTab: string | null): boolean {
  return shownTab !== null && state.groups.length < MAX_GROUPS;
}

/**
 * Split Right / Split Down: the focused group splits in `direction`, and its tab on screen
 * also opens in the new group (a file) or moves there (a commit, Git, branch or terminal
 * tab), which takes the focus.
 */
export function splitGroup(state: GroupsState, shownTab: string | null, direction: SplitDirection): GroupsState {
  if (!canSplit(state, shownTab) || shownTab === null) {
    return state;
  }
  return openInGroup(state, state.nextId, shownTab, true, direction);
}

/** Move Tab to Other Group: out of `groupId` into the next group, made to its right when there is none. */
export function moveToOtherGroup(state: GroupsState, groupId: number, tabPath: string): GroupsState {
  const source = groupById(state, groupId);
  if (!source || !hasTab(source, tabPath)) {
    return state;
  }
  const existing = otherGroup(state, groupId)?.id ?? null;
  if (existing === null && state.groups.length >= MAX_GROUPS) {
    return state;
  }
  const target = existing ?? state.nextId;
  const withTarget = existing === null ? ensureGroup(state, target, "right", groupId) : state;
  const tab = source.tabs.find((candidate) => candidate.path === tabPath) as FileTab;
  const closed = withGroup(withTarget, groupId, closeTabs(source, [tabPath]));
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
  const layout = keepInLayout(state.layout, new Set(groups.map((group) => group.id))) ?? leafLayout(groups[0].id);
  const next = withLayout(state, layout);
  return { ...next, focused: state.focused === groupId ? (otherGroup(state, groupId) ?? next.groups[0]).id : state.focused };
}

/** A splitter was dragged: the split at `path` (see groupLayout.ts) gets `ratio`. */
export function setGroupRatio(state: GroupsState, path: string, ratio: number): GroupsState {
  const layout = setSplitRatio(state.layout, path, ratio);
  return layout === state.layout ? state : { ...state, layout };
}

/** Setting turned off: one group with every tab, the focused group's tab on screen. */
export function mergeGroups(state: GroupsState): GroupsState {
  if (state.groups.length < 2) {
    return state;
  }
  const [first] = state.groups;
  const tabs = allTabs(state);
  return {
    ...state,
    groups: [{ id: first.id, tabs, active: focusedGroup(state).active ?? first.active }],
    layout: leafLayout(first.id),
    focused: first.id,
  };
}

const keyOf = (groupId: number, tabPath: string) => `${groupId}\n${tabPath}`;

/**
 * The tab limit over all groups: every group's tab counts, the least recently used close
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

/** Index (in layout order) of the group holding `tabPath`, the focused one first; -1 when none does. */
export function sideOf(state: GroupsState, tabPath: string): number {
  const focusedIndex = state.groups.findIndex((group) => group.id === state.focused);
  if (focusedIndex >= 0 && hasTab(state.groups[focusedIndex], tabPath)) {
    return focusedIndex;
  }
  return state.groups.findIndex((group) => hasTab(group, tabPath));
}

/**
 * Restored groups as one state: group `index` gets id `index`, `layout` uses those ids
 * (side by side when it is missing or does not fit), and groups left without tabs close.
 */
export function restoredGroups(saved: readonly TabsState[], layout: GroupLayout | null, focusedIndex: number): GroupsState {
  const all = (saved.length > 0 ? saved : [{ tabs: [], active: null }]).slice(0, MAX_GROUPS);
  const groups: EditorGroup[] = all.map((group, index) => ({ id: index, tabs: group.tabs, active: group.active }));
  const fitting = layout && parseGroupLayout(layout, groups.length) ? layout : rowLayout(groups.map((group) => group.id));
  const state: GroupsState = withLayout({ groups, layout: fitting, focused: 0, nextId: groups.length }, fitting);
  const focused = groupById(state, focusedIndex) ? focusedIndex : state.groups[0].id;
  return dropEmptyGroups({ ...state, focused }, false);
}
