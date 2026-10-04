import { describe, expect, it } from "vitest";
import { type ClosedTab, MAX_CLOSED_TABS, popClosedTab, pushClosedTabs, reopenAt, type ReopenTab, updateClosedPosition } from "./closedTabs";

function closed(path: string, index = 0): ClosedTab {
  return { path, index, preview: false, pinned: false, position: null };
}

describe("pushClosedTabs", () => {
  it("puts the newest last and never lists a path twice", () => {
    const stack = pushClosedTabs([closed("/a"), closed("/b")], [closed("/a", 3)]);
    expect(stack.map((tab) => tab.path)).toEqual(["/b", "/a"]);
    expect(stack[1].index).toBe(3);
  });

  it("drops the oldest past the limit", () => {
    const many = Array.from({ length: MAX_CLOSED_TABS + 4 }, (_, index) => closed(`/f${index}`));
    const stack = pushClosedTabs([], many);
    expect(stack).toHaveLength(MAX_CLOSED_TABS);
    expect(stack[0].path).toBe("/f4");
    expect(pushClosedTabs(stack, [closed("/new")], MAX_CLOSED_TABS).at(-1)?.path).toBe("/new");
  });
});

describe("popClosedTab", () => {
  it("takes the newest tab that can reopen and drops the ones that cannot", () => {
    const stack = [closed("/a"), closed("/b"), closed("/c")];
    const { tab, stack: rest } = popClosedTab(stack, (entry) => entry.path !== "/c");
    expect(tab?.path).toBe("/b");
    expect(rest.map((entry) => entry.path)).toEqual(["/a"]);
  });

  it("returns null with an empty stack when nothing can reopen", () => {
    expect(popClosedTab([closed("/a")], () => false)).toEqual({ tab: null, stack: [] });
    expect(popClosedTab([], () => true)).toEqual({ tab: null, stack: [] });
  });
});

describe("updateClosedPosition", () => {
  it("gives the newest entry of the path the position", () => {
    const position = { line: 9, column: 1, topLine: 4 };
    const stack = [closed("/a"), closed("/b")];
    const next = updateClosedPosition(stack, "/a", position);
    expect(next[0].position).toEqual(position);
    expect(stack[0].position).toBeNull();
    expect(updateClosedPosition(stack, "/missing", position)).toBe(stack);
  });
});

describe("reopenAt", () => {
  const tabs: ReopenTab[] = [
    { path: "/a", preview: false, dirty: false },
    { path: "/b", preview: false, dirty: true },
  ];
  const make = (entry: ClosedTab): ReopenTab => ({ path: entry.path, preview: false, dirty: false, pinned: entry.pinned });

  it("puts the tab back at its old index and makes it active", () => {
    const { tabs: next, active } = reopenAt(tabs, { ...closed("/x", 1), pinned: true }, make);
    expect(next.map((tab) => tab.path)).toEqual(["/a", "/x", "/b"]);
    expect(next[1].pinned).toBe(true);
    expect(active).toBe("/x");
  });

  it("appends when fewer tabs are left, and only activates an open one", () => {
    expect(reopenAt(tabs, closed("/x", 9), make).tabs.map((tab) => tab.path)).toEqual(["/a", "/b", "/x"]);
    expect(reopenAt(tabs, closed("/b", 0), make)).toEqual({ tabs, active: "/b" });
  });
});
