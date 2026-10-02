import { describe, expect, it } from "vitest";
import { adjacentTab, closeTabs, openTab, otherPaths, pathsToRight, pinTab, setTabDirty, tabLabels, type TabsState } from "./tabs";

const empty: TabsState = { tabs: [], active: null };

function paths(state: TabsState): string[] {
  return state.tabs.map((tab) => `${tab.path}${tab.preview ? "*" : ""}${tab.dirty ? "!" : ""}`);
}

describe("openTab", () => {
  it("replaces the preview tab on single-click opens", () => {
    let state = openTab(empty, "a.ts", false);
    state = openTab(state, "b.ts", false);
    expect(paths(state)).toEqual(["b.ts*"]);
    expect(state.active).toBe("b.ts");
  });

  it("keeps pinned tabs and opens new ones after the active tab", () => {
    let state = openTab(empty, "a.ts", true);
    state = openTab(state, "b.ts", true);
    state = { ...state, active: "a.ts" };
    state = openTab(state, "c.ts", false);
    expect(paths(state)).toEqual(["a.ts", "c.ts*", "b.ts"]);
  });

  it("activates an existing tab and pins it on double-click", () => {
    let state = openTab(empty, "a.ts", false);
    state = openTab(state, "a.ts", true);
    expect(paths(state)).toEqual(["a.ts"]);
  });

  it("never replaces a preview tab with unsaved changes", () => {
    let state = openTab(empty, "a.ts", false);
    state = { ...state, tabs: [{ path: "a.ts", preview: true, dirty: true }] };
    state = openTab(state, "b.ts", false);
    expect(paths(state)).toEqual(["a.ts*!", "b.ts*"]);
  });
});

describe("pinning and dirty state", () => {
  it("editing pins the preview tab", () => {
    let state = openTab(empty, "a.ts", false);
    state = setTabDirty(state, "a.ts", true);
    expect(paths(state)).toEqual(["a.ts!"]);
    state = setTabDirty(state, "a.ts", false);
    expect(paths(state)).toEqual(["a.ts"]);
    state = openTab(state, "b.ts", false);
    expect(paths(state)).toEqual(["a.ts", "b.ts*"]);
  });

  it("pins explicitly", () => {
    expect(paths(pinTab(openTab(empty, "a.ts", false), "a.ts"))).toEqual(["a.ts"]);
  });

  it("returns the same state when nothing changes", () => {
    const state = openTab(empty, "a.ts", true);
    expect(setTabDirty(state, "a.ts", false)).toBe(state);
  });
});

describe("closing", () => {
  const three: TabsState = {
    tabs: [
      { path: "a", preview: false, dirty: false },
      { path: "b", preview: false, dirty: false },
      { path: "c", preview: false, dirty: false },
    ],
    active: "b",
  };

  it("activates the right neighbour, then the left", () => {
    expect(closeTabs(three, ["b"]).active).toBe("c");
    expect(closeTabs({ ...three, active: "c" }, ["c"]).active).toBe("b");
    expect(closeTabs(three, ["a", "b", "c"]).active).toBeNull();
  });

  it("keeps the active tab when closing others", () => {
    const closed = closeTabs(three, otherPaths(three, "b"));
    expect(paths(closed)).toEqual(["b"]);
    expect(closed.active).toBe("b");
    expect(pathsToRight(three, "a")).toEqual(["b", "c"]);
  });
});

describe("tabLabels", () => {
  it("adds the folder only for duplicate names", () => {
    const labels = tabLabels([
      { path: "apps/web/index.ts", preview: false, dirty: false },
      { path: "apps/api/index.ts", preview: false, dirty: false },
      { path: "README.md", preview: false, dirty: false },
    ]);
    expect(labels.get("apps/web/index.ts")).toEqual({ name: "index.ts", hint: "web" });
    expect(labels.get("apps/api/index.ts")).toEqual({ name: "index.ts", hint: "api" });
    expect(labels.get("README.md")).toEqual({ name: "README.md", hint: null });
  });
});

describe("adjacentTab", () => {
  const tabs = ["/w/a.ts", "/w/b.ts", "/w/c.ts"].map((path) => ({ path, preview: false, dirty: false }));

  it("steps to the next and previous tab, wrapping around", () => {
    expect(adjacentTab(tabs, "/w/a.ts", 1)).toBe("/w/b.ts");
    expect(adjacentTab(tabs, "/w/c.ts", 1)).toBe("/w/a.ts");
    expect(adjacentTab(tabs, "/w/a.ts", -1)).toBe("/w/c.ts");
  });

  it("starts at an end when no tab is on screen", () => {
    expect(adjacentTab(tabs, null, 1)).toBe("/w/a.ts");
    expect(adjacentTab(tabs, null, -1)).toBe("/w/c.ts");
    expect(adjacentTab(tabs, "/w/gone.ts", 1)).toBe("/w/a.ts");
  });

  it("has nothing to switch to without tabs", () => {
    expect(adjacentTab([], null, 1)).toBeNull();
  });
});
