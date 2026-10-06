import { describe, expect, it } from "vitest";
import type { GroupLayout } from "./groupLayout";
import {
  isSavablePath,
  MAX_SAVED_TABS,
  MAX_TAB_SESSIONS,
  parseTabPosition,
  parseTabSession,
  parseTabSessions,
  restorableTabs,
  sameTabSession,
  sessionPaths,
  sessionWithKept,
  type SavedTabSession,
  tabSessionOf,
  withTabSession,
} from "./tabSession";

const session: SavedTabSession = {
  tabs: [
    { path: "/w/a.ts", preview: false, pinned: true, position: { line: 4, column: 2, topLine: 1.5 } },
    { path: "/w/b.ts", preview: true, pinned: false, position: null },
  ],
  active: "/w/b.ts",
};

describe("isSavablePath", () => {
  it("takes absolute paths only", () => {
    expect(isSavablePath("/w/a.ts")).toBe(true);
    expect(isSavablePath("C:/w/a.ts")).toBe(true);
    expect(isSavablePath("C:\\w\\a.ts")).toBe(true);
    expect(isSavablePath("a.ts")).toBe(false);
    expect(isSavablePath("commit:abcd@/w")).toBe(false);
    expect(isSavablePath("terminal:3")).toBe(false);
    expect(isSavablePath("/")).toBe(false);
    expect(isSavablePath("/w/a\0b")).toBe(false);
    expect(isSavablePath(`/${"x".repeat(5000)}`)).toBe(false);
    expect(isSavablePath(42)).toBe(false);
  });
});

describe("parseTabPosition", () => {
  it("keeps whole lines and columns and a rounded top line", () => {
    expect(parseTabPosition({ line: 3.7, column: 2, topLine: 1.234 })).toEqual({ line: 3, column: 2, topLine: 1.23 });
  });

  it("drops a position without a usable line and fills in the rest", () => {
    expect(parseTabPosition({ column: 2 })).toBeNull();
    expect(parseTabPosition({ line: -1 })).toBeNull();
    expect(parseTabPosition({ line: Number.NaN })).toBeNull();
    expect(parseTabPosition("3:4")).toBeNull();
    expect(parseTabPosition({ line: 20, column: "x", topLine: -3 })).toEqual({ line: 20, column: 0, topLine: 15 });
  });

  it("caps huge numbers from a hand edit", () => {
    expect(parseTabPosition({ line: 1e20, column: 0, topLine: 0 })?.line).toBe(10_000_000);
  });
});

describe("parseTabSession", () => {
  it("reads what the app writes", () => {
    expect(parseTabSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
  });

  it("drops bad and repeated tabs, and an active tab that is not listed", () => {
    const parsed = parseTabSession({
      tabs: [{ path: "/w/a.ts", preview: "yes" }, { path: "/w/a.ts" }, { path: "rel.ts" }, null, 7, { path: "/w/c.ts", pinned: true }],
      active: "/w/missing.ts",
    });
    expect(parsed).toEqual({
      tabs: [
        { path: "/w/a.ts", preview: false, pinned: false, position: null },
        { path: "/w/c.ts", preview: false, pinned: true, position: null },
      ],
      active: null,
    });
  });

  it("is null without any usable tab", () => {
    expect(parseTabSession({ tabs: [] })).toBeNull();
    expect(parseTabSession({ tabs: "a" })).toBeNull();
    expect(parseTabSession([])).toBeNull();
    expect(parseTabSession(null)).toBeNull();
  });

  it("keeps at most MAX_SAVED_TABS tabs", () => {
    const tabs = Array.from({ length: MAX_SAVED_TABS + 10 }, (_, index) => ({ path: `/w/${index}.ts` }));
    expect(parseTabSession({ tabs })?.tabs).toHaveLength(MAX_SAVED_TABS);
  });
});

describe("parseTabSessions", () => {
  it("keeps valid sessions by workspace id and drops the rest", () => {
    expect(parseTabSessions({ "/w": session, "/x": { tabs: [] }, "": session, "/y": "nope" })).toEqual({ "/w": session });
    expect(parseTabSessions(["/w"])).toEqual({});
    expect(parseTabSessions(undefined)).toEqual({});
  });

  it("keeps the newest MAX_TAB_SESSIONS workspaces", () => {
    const many = Object.fromEntries(Array.from({ length: MAX_TAB_SESSIONS + 5 }, (_, index) => [`/w${index}`, session]));
    const parsed = parseTabSessions(many);
    expect(Object.keys(parsed)).toHaveLength(MAX_TAB_SESSIONS);
    expect(Object.keys(parsed)[0]).toBe("/w5");
  });
});

describe("withTabSession", () => {
  it("moves the saved workspace to the end and caps the list", () => {
    const next = withTabSession({ "/a": session, "/b": session }, "/a", session);
    expect(Object.keys(next)).toEqual(["/b", "/a"]);
    const full = Object.fromEntries(Array.from({ length: MAX_TAB_SESSIONS }, (_, index) => [`/w${index}`, session]));
    const added = withTabSession(full, "/new", session);
    expect(Object.keys(added)).toHaveLength(MAX_TAB_SESSIONS);
    expect(Object.keys(added).at(-1)).toBe("/new");
    expect(added["/w0"]).toBeUndefined();
  });

  it("forgets a workspace with no tabs left", () => {
    expect(withTabSession({ "/a": session }, "/a", { tabs: [], active: null })).toEqual({});
    expect(withTabSession({ "/a": session }, "/a", null)).toEqual({});
  });
});

describe("tabSessionOf", () => {
  it("saves file tabs in order with their positions, never pseudo tabs", () => {
    const positions = new Map([["/w/a.ts", { line: 1, column: 0, topLine: 0 }]]);
    const saved = tabSessionOf(
      [
        {
          tabs: [
            { path: "/w/a.ts", preview: false, pinned: true },
            { path: "terminal:1", preview: false },
            { path: "/w/b.ts", preview: true },
          ],
          active: "terminal:1",
        },
      ],
      null,
      0,
      (tabPath) => tabPath.startsWith("/"),
      positions,
    );
    expect(saved).toEqual({
      tabs: [
        { path: "/w/a.ts", preview: false, pinned: true, position: { line: 1, column: 0, topLine: 0 } },
        { path: "/w/b.ts", preview: true, pinned: false, position: null },
      ],
      active: null,
    });
  });

  it("caps the saved tabs", () => {
    const tabs = Array.from({ length: MAX_SAVED_TABS + 3 }, (_, index) => ({ path: `/w/${index}.ts`, preview: false }));
    expect(tabSessionOf([{ tabs, active: null }], null, 0, () => true, new Map()).tabs).toHaveLength(MAX_SAVED_TABS);
  });

  it("compares sessions by content", () => {
    expect(sameTabSession(session, JSON.parse(JSON.stringify(session)))).toBe(true);
    expect(sameTabSession(session, { ...session, active: null })).toBe(false);
    expect(sameTabSession(null, null)).toBe(true);
  });
});

describe("restorableTabs", () => {
  it("skips files that are gone or outside the workspace", () => {
    const restored = restorableTabs(session, [true, false], () => true);
    expect(restored.tabs.map((tab) => tab.path)).toEqual(["/w/a.ts"]);
    // The active tab is gone, so the first one left is shown.
    expect(restored.active).toBe("/w/a.ts");
    expect(restorableTabs(session, [true, true], (filePath) => filePath !== "/w/a.ts").tabs.map((tab) => tab.path)).toEqual([
      "/w/b.ts",
    ]);
  });

  it("restores nothing when the existence check failed", () => {
    expect(restorableTabs(session, [], () => true)).toEqual({ tabs: [], active: null });
  });
});

describe("split editor sessions", () => {
  const right = { tabs: [{ path: "/w/c.ts", preview: false, pinned: false, position: null }], active: "/w/c.ts" };
  const below = { tabs: [{ path: "/w/d.ts", preview: false, pinned: false, position: null }], active: "/w/d.ts" };
  const leaf = (groupId: number): GroupLayout => ({ kind: "group", groupId });
  const sideBySide: GroupLayout = { kind: "split", direction: "right", ratio: 0.5, first: leaf(0), second: leaf(1) };
  // 0 on the left; 1 above 2 on the right.
  const grid: GroupLayout = {
    kind: "split",
    direction: "right",
    ratio: 0.4,
    first: leaf(0),
    second: { kind: "split", direction: "down", ratio: 0.5, first: leaf(1), second: leaf(2) },
  };
  const split: SavedTabSession = { ...session, groups: [right, below], layout: grid, focused: 2 };

  it("keeps valid groups and their layout", () => {
    expect(parseTabSession(JSON.parse(JSON.stringify(split)))).toEqual(split);
    // The top right group has no valid tab, so the one below it takes the whole right side.
    expect(parseTabSession({ ...split, groups: [{ tabs: [{ path: "relative.ts" }] }, below] })).toEqual({
      ...session,
      groups: [below],
      layout: { ...sideBySide, ratio: 0.4 },
      focused: 1,
    });
  });

  it("puts groups side by side when the layout does not fit", () => {
    const parsed = parseTabSession({ ...split, layout: "nonsense", focused: "yes" });
    expect(parsed?.groups).toEqual([right, below]);
    expect(parsed?.layout?.kind).toBe("split");
    expect(parsed?.focused).toBe(0);
  });

  it("reads the right group of older versions", () => {
    expect(parseTabSession({ ...session, right, rightFocused: true })).toEqual({ ...session, groups: [right], layout: sideBySide, focused: 1 });
    expect(parseTabSession({ ...session, right: "nonsense", rightFocused: "yes" })).toEqual(session);
    expect(parseTabSession({ tabs: [], right })).toEqual(right);
  });

  it("saves only groups with file tabs, numbered in layout order", () => {
    const groups = [
      { tabs: [{ path: "/w/a.ts", preview: false }], active: "/w/a.ts" },
      { tabs: [{ path: "terminal:1", preview: false }], active: "terminal:1" },
      { tabs: [{ path: "/w/d.ts", preview: false }], active: "/w/d.ts" },
    ];
    const saved = tabSessionOf(groups, grid, 2, (tabPath) => tabPath.startsWith("/"), new Map());
    expect(saved.groups?.map((group) => group.tabs.map((tab) => tab.path))).toEqual([["/w/d.ts"]]);
    expect(saved.layout).toEqual({ ...sideBySide, ratio: 0.4 });
    expect(saved.focused).toBe(1);
    const single = tabSessionOf(groups.slice(0, 2), sideBySide, 1, (tabPath) => tabPath.startsWith("/"), new Map());
    expect(single.groups).toBeUndefined();
  });

  it("restores every group, dropping groups with nothing left", () => {
    expect(sessionPaths(split)).toEqual(["/w/a.ts", "/w/b.ts", "/w/c.ts", "/w/d.ts"]);
    expect(restorableTabs(split, [true, true, true, true], () => true).groups).toHaveLength(2);
    const noTop = restorableTabs(split, [true, true, false, true], () => true);
    expect(noTop.groups).toEqual([below]);
    expect(noTop.focused).toBe(1);
    const onlyRight = restorableTabs(split, [false, false, true, false], () => true);
    expect(onlyRight.tabs.map((tab) => tab.path)).toEqual(["/w/c.ts"]);
    expect(onlyRight.groups).toBeUndefined();
  });
});

describe("Untitled tabs in a session", () => {
  const untitled = "untitled:k3j2x9";

  it("keeps Untitled tabs and refuses look-alikes", () => {
    const parsed = parseTabSession({
      tabs: [{ path: untitled }, { path: "untitled:../x" }, { path: "untitled:" }, { path: "/w/a.ts" }],
      active: untitled,
    });
    expect(parsed?.tabs.map((tab) => tab.path)).toEqual([untitled, "/w/a.ts"]);
    expect(parsed?.active).toBe(untitled);
    const saved = tabSessionOf([{ tabs: [{ path: untitled, preview: false }], active: untitled }], null, 0, () => true, new Map());
    expect(saved.tabs.map((tab) => tab.path)).toEqual([untitled]);
  });
});

describe("sessionWithKept", () => {
  const untitled = "untitled:k3j2x9";

  it("restores the whole session with the kept tabs, adding kept tabs it lacks", () => {
    const merged = sessionWithKept(session, ["/w/b.ts", untitled], true);
    expect(merged?.tabs.map((tab) => tab.path)).toEqual(["/w/a.ts", "/w/b.ts", untitled]);
    expect(merged?.active).toBe("/w/b.ts");
    expect(merged?.tabs[2]).toEqual({ path: untitled, preview: false, pinned: false, position: null });
  });

  it("restores only the kept tabs when Reopen tabs on start is off", () => {
    const merged = sessionWithKept(session, [untitled], false);
    expect(merged).toEqual({ tabs: [{ path: untitled, preview: false, pinned: false, position: null }], active: untitled });
    expect(sessionWithKept(session, [], false)).toBeNull();
  });

  it("works without a saved session and keeps the other groups", () => {
    expect(sessionWithKept(null, [], true)).toBeNull();
    expect(sessionWithKept(null, ["/w/c.ts"], true)?.tabs.map((tab) => tab.path)).toEqual(["/w/c.ts"]);
    const right = { tabs: [{ path: "/w/r.ts", preview: false, pinned: false, position: null }], active: "/w/r.ts" };
    const layout: GroupLayout = { kind: "split", direction: "down", ratio: 0.5, first: { kind: "group", groupId: 0 }, second: { kind: "group", groupId: 1 } };
    const split: SavedTabSession = { ...session, groups: [right], layout, focused: 1 };
    const merged = sessionWithKept(split, [untitled], true);
    expect(merged?.groups?.map((group) => group.tabs.map((tab) => tab.path))).toEqual([["/w/r.ts"]]);
    expect(merged?.layout).toEqual(layout);
    expect(merged?.focused).toBe(1);
    expect(merged?.tabs.map((tab) => tab.path)).toEqual(["/w/a.ts", "/w/b.ts", untitled]);
  });
});
