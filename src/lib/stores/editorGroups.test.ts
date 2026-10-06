import { describe, expect, it } from "vitest";
import { commitTabPath } from "./commitTabs";
import {
  allTabs,
  applyEvictions,
  canSplit,
  closedBetween,
  closeGroup,
  closeInGroups,
  dropEmptyGroups,
  focusedGroup,
  focusGroup,
  groupEvictions,
  type GroupsState,
  initialGroups,
  mergeGroups,
  moveToOtherGroup,
  openInGroup,
  openTarget,
  restoredGroups,
  setDirtyEverywhere,
  setGroupRatio,
  sideOf,
  splitGroup,
} from "./editorGroups";
import { groupRects, layoutGroupIds, MAX_GROUPS } from "./groupLayout";
import type { FileTab } from "./tabs";

const isFile = (tabPath: string) => tabPath.startsWith("/");
const tab = (path: string, extra: Partial<FileTab> = {}): FileTab => ({ path, preview: false, dirty: false, ...extra });

function open(state: GroupsState, ...paths: string[]): GroupsState {
  return paths.reduce((next, path) => openInGroup(next, next.focused, path, true), state);
}

function paths(state: GroupsState): string[][] {
  return state.groups.map((group) => group.tabs.map((entry) => entry.path));
}

/** Left with a.ts and b.ts, right with c.ts, the right one focused. */
function split(): GroupsState {
  const left = open(initialGroups(), "/a.ts", "/b.ts");
  return openInGroup(left, left.nextId, "/c.ts", true);
}

describe("editor groups", () => {
  it("starts with one empty group", () => {
    const state = initialGroups();
    expect(state.groups).toHaveLength(1);
    expect(focusedGroup(state).id).toBe(0);
    expect(allTabs(state)).toEqual([]);
  });

  it("opens into the focused group and makes the right group on demand", () => {
    const state = split();
    expect(paths(state)).toEqual([["/a.ts", "/b.ts"], ["/c.ts"]]);
    expect(state.focused).toBe(1);
    expect(state.nextId).toBe(2);
    expect(focusedGroup(state).active).toBe("/c.ts");
  });

  it("makes a new group by splitting the focused one", () => {
    const state = openInGroup(split(), 2, "/d.ts", true, "down");
    expect(paths(state)).toEqual([["/a.ts", "/b.ts"], ["/c.ts"], ["/d.ts"]]);
    expect(groupRects(state.layout).get(2)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });

  it("never makes more than the most groups", () => {
    let state = split();
    for (let index = 0; index < MAX_GROUPS; index++) {
      state = splitGroup(state, "/c.ts", index % 2 === 0 ? "down" : "right");
    }
    expect(state.groups).toHaveLength(MAX_GROUPS);
    expect(canSplit(state, "/c.ts")).toBe(false);
    expect(openInGroup(state, state.nextId, "/d.ts", true).groups).toHaveLength(MAX_GROUPS);
  });

  it("shows a tab where it is open, the focused group first", () => {
    const state = split();
    expect(openTarget(state, "/a.ts")).toBe(0);
    expect(openTarget(state, "/new.ts")).toBe(1);
    const both = openInGroup(state, 1, "/a.ts", true);
    expect(openTarget(both, "/a.ts")).toBe(1);
    expect(openTarget(focusGroup(both, 0), "/a.ts")).toBe(0);
  });

  it("opens to the side in the other group, or the one it would create", () => {
    const one = open(initialGroups(), "/a.ts");
    expect(openTarget(one, "/a.ts", true)).toBe(1);
    expect(openTarget(split(), "/a.ts", true)).toBe(0);
  });

  it("lists every tab once, left group first", () => {
    const state = openInGroup(split(), 1, "/a.ts", true);
    expect(allTabs(state).map((entry) => entry.path)).toEqual(["/a.ts", "/b.ts", "/c.ts"]);
  });

  it("keeps a pseudo tab in one group only", () => {
    const commit = commitTabPath("/repo", "abc123");
    const left = open(initialGroups(), "/a.ts", commit);
    const moved = openInGroup(left, left.nextId, commit, true);
    expect(paths(moved)).toEqual([["/a.ts"], [commit]]);
  });

  it("counts a tab as closed only when no group has it", () => {
    const state = openInGroup(split(), 1, "/a.ts", true);
    const leftOnly = closeInGroups(state, ["/a.ts"], 0);
    expect(closedBetween(state, leftOnly)).toEqual([]);
    const everywhere = closeInGroups(state, ["/a.ts"], null);
    expect(closedBetween(state, everywhere).map((entry) => entry.path)).toEqual(["/a.ts"]);
  });

  it("returns the same state when nothing closes", () => {
    const state = split();
    expect(closeInGroups(state, ["/missing.ts"], null)).toBe(state);
  });

  it("drops an empty group and moves the focus to its neighbour", () => {
    const state = split();
    const right = dropEmptyGroups(closeInGroups(state, ["/c.ts"], 1), false);
    expect(right.groups.map((group) => group.id)).toEqual([0]);
    expect(right.focused).toBe(0);
    const left = dropEmptyGroups(closeInGroups(focusGroup(state, 0), ["/a.ts", "/b.ts"], 0), false);
    expect(left.groups.map((group) => group.id)).toEqual([1]);
    expect(left.focused).toBe(1);
  });

  it("keeps an empty first group while it shows the diff or the Log", () => {
    const state = closeInGroups(split(), ["/a.ts", "/b.ts"], 0);
    expect(dropEmptyGroups(state, true).groups).toHaveLength(2);
  });

  it("keeps the last group even when empty", () => {
    const state = closeInGroups(open(initialGroups(), "/a.ts"), ["/a.ts"], null);
    expect(dropEmptyGroups(state, false).groups).toHaveLength(1);
  });

  it("splits the tab on screen to the right", () => {
    const state = open(initialGroups(), "/a.ts", "/b.ts");
    const next = splitGroup(state, "/b.ts", "right");
    expect(paths(next)).toEqual([["/a.ts", "/b.ts"], ["/b.ts"]]);
    expect(next.focused).toBe(1);
    expect(groupRects(next.layout).get(1)).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
    expect(canSplit(state, null)).toBe(false);
    expect(splitGroup(state, null, "right")).toBe(state);
  });

  it("splits a tab that is not on screen without changing the first group's tab", () => {
    const state = open(initialGroups(), "/a.ts", "/b.ts");
    const next = splitGroup(state, "/a.ts", "down");
    expect(paths(next)).toEqual([["/a.ts", "/b.ts"], ["/a.ts"]]);
    expect(next.groups[0].active).toBe("/b.ts");
    expect(groupRects(next.layout).get(1)).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 });
  });

  it("splits the focused group again, so the groups form a grid", () => {
    // Left a.ts | right c.ts; splitting the left group down puts the new group under it.
    const state = splitGroup(focusGroup(split(), 0), "/a.ts", "down");
    expect(paths(state)).toEqual([["/a.ts", "/b.ts"], ["/a.ts"], ["/c.ts"]]);
    expect(layoutGroupIds(state.layout)).toEqual([0, 2, 1]);
    expect(groupRects(state.layout).get(2)).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 });
    expect(state.focused).toBe(2);
  });

  it("gives a closed group's room to its neighbour in the split", () => {
    const state = splitGroup(focusGroup(split(), 0), "/a.ts", "down");
    const closed = closeGroup(state, 2);
    expect(paths(closed)).toEqual([["/a.ts", "/b.ts"], ["/c.ts"]]);
    expect(groupRects(closed.layout).get(0)).toEqual({ x: 0, y: 0, width: 0.5, height: 1 });
  });

  it("moves a splitter", () => {
    const state = setGroupRatio(split(), "", 0.3);
    expect(groupRects(state.layout).get(1)?.x).toBeCloseTo(0.3);
    expect(setGroupRatio(state, "", 0.3)).toBe(state);
  });

  it("moves a tab to the other group with its flags", () => {
    const state = setDirtyEverywhere(open(initialGroups(), "/a.ts", "/b.ts"), "/b.ts", true);
    const moved = moveToOtherGroup(state, 0, "/b.ts");
    expect(paths(moved)).toEqual([["/a.ts"], ["/b.ts"]]);
    expect(moved.groups[1].tabs[0].dirty).toBe(true);
    expect(moved.focused).toBe(1);
    const back = dropEmptyGroups(moveToOtherGroup(moved, 1, "/b.ts"), false);
    expect(paths(back)).toEqual([["/a.ts", "/b.ts"]]);
  });

  it("marks unsaved edits in every group", () => {
    const state = openInGroup(split(), 1, "/a.ts", true);
    const dirty = setDirtyEverywhere(state, "/a.ts", true);
    expect(dirty.groups.map((group) => group.tabs.find((entry) => entry.path === "/a.ts")?.dirty)).toEqual([true, true]);
    expect(setDirtyEverywhere(dirty, "/a.ts", true)).toBe(dirty);
  });

  it("closes a group and focuses the one left", () => {
    const state = closeGroup(split(), 1);
    expect(paths(state)).toEqual([["/a.ts", "/b.ts"]]);
    expect(state.focused).toBe(0);
    expect(closeGroup(state, 0)).toBe(state);
  });

  it("merges the groups when splitting is turned off", () => {
    const state = openInGroup(split(), 1, "/a.ts", true);
    const merged = mergeGroups(state);
    expect(paths(merged)).toEqual([["/a.ts", "/b.ts", "/c.ts"]]);
    expect(merged.groups[0].active).toBe("/a.ts");
    expect(merged.focused).toBe(0);
  });

  it("applies one tab limit over both groups, never closing a group's tab on screen", () => {
    const state = split();
    const used = new Map([
      ["/a.ts", 1],
      ["/b.ts", 2],
      ["/c.ts", 3],
    ]);
    // b.ts is the left group's tab on screen and c.ts the right one's.
    expect(groupEvictions(state, used, 2, null, isFile)).toEqual([{ groupId: 0, tabPath: "/a.ts" }]);
    const single = groupEvictions(state, used, 1, null, isFile);
    expect(applyEvictions(state, single).groups.map((group) => group.tabs.length)).toEqual([1, 1]);
    expect(groupEvictions(state, used, 0, null, isFile)).toEqual([]);
  });

  it("finds the side a tab is on", () => {
    const state = split();
    expect(sideOf(state, "/a.ts")).toBe(0);
    expect(sideOf(state, "/c.ts")).toBe(1);
    expect(sideOf(state, "/x.ts")).toBe(-1);
  });

  it("restores the groups side by side, dropping empty ones", () => {
    const left = { tabs: [tab("/a.ts")], active: "/a.ts" };
    const right = { tabs: [tab("/b.ts")], active: "/b.ts" };
    const empty = { tabs: [], active: null };
    expect(paths(restoredGroups([left, right], null, 1))).toEqual([["/a.ts"], ["/b.ts"]]);
    expect(restoredGroups([left, right], null, 1).focused).toBe(1);
    expect(paths(restoredGroups([left, empty], null, 1))).toEqual([["/a.ts"]]);
    expect(paths(restoredGroups([empty, right], null, 0))).toEqual([["/b.ts"]]);
    expect(restoredGroups([], null, 0).groups).toHaveLength(1);
  });

  it("restores a saved layout", () => {
    const groups = [
      { tabs: [tab("/a.ts")], active: "/a.ts" },
      { tabs: [tab("/b.ts")], active: "/b.ts" },
    ];
    const state = restoredGroups(
      groups,
      { kind: "split", direction: "down", ratio: 0.25, first: { kind: "group", groupId: 0 }, second: { kind: "group", groupId: 1 } },
      0,
    );
    expect(groupRects(state.layout).get(1)).toEqual({ x: 0, y: 0.25, width: 1, height: 0.75 });
    expect(state.nextId).toBe(2);
  });
});
