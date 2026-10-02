import { describe, expect, it } from "vitest";
import { isPseudoTab } from "$lib/stores/pseudoTabs";
import { commitTabPath } from "$lib/stores/commitTabs";
import { tabLabels, tabsInFolder, TERMINAL_TAB_LABEL } from "$lib/stores/tabs";
import {
  isTerminalTab,
  panelAfterLeave,
  type PlacedTerminal,
  parseTerminalTabPath,
  terminalKeysOf,
  terminalPlacement,
  terminalTabPath,
} from "./terminalTabs";

describe("terminal tab paths", () => {
  it("round-trips the terminal key", () => {
    expect(terminalTabPath(7)).toBe("terminal:7");
    expect(parseTerminalTabPath(terminalTabPath(7))).toBe(7);
    expect(isTerminalTab(terminalTabPath(42))).toBe(true);
  });

  it("never mistakes a file or a commit for a terminal tab", () => {
    expect(parseTerminalTabPath("/work/acme/terminal:1")).toBeNull();
    expect(parseTerminalTabPath("terminal:")).toBeNull();
    expect(parseTerminalTabPath("terminal:0")).toBeNull();
    expect(parseTerminalTabPath("terminal:-3")).toBeNull();
    expect(parseTerminalTabPath("terminal:1.5")).toBeNull();
    expect(parseTerminalTabPath("terminal:01")).toBeNull();
    expect(parseTerminalTabPath("terminal:12abc")).toBeNull();
    expect(parseTerminalTabPath("terminal:99999999999999999")).toBeNull();
    expect(isTerminalTab(commitTabPath("/work/acme", "a9f492bf"))).toBe(false);
  });

  it("finds the terminals among closed tabs", () => {
    expect(terminalKeysOf(["/work/a.ts", "terminal:3", commitTabPath("/work", "a9f492bf"), "terminal:1"])).toEqual([3, 1]);
    expect(terminalKeysOf([])).toEqual([]);
  });

  it("counts terminal and commit tabs as pseudo tabs, files not", () => {
    expect(isPseudoTab(terminalTabPath(1))).toBe(true);
    expect(isPseudoTab(commitTabPath("/work/acme", "a9f492bf"))).toBe(true);
    expect(isPseudoTab("/work/acme/src/cart.ts")).toBe(false);
  });
});

describe("terminal tabs in the tab strip", () => {
  it("labels a terminal tab with a placeholder and keeps it out of duplicate names", () => {
    const labels = tabLabels([
      { path: terminalTabPath(1), preview: false, dirty: false },
      { path: "/work/acme/1", preview: false, dirty: false },
    ]);
    expect(labels.get(terminalTabPath(1))).toEqual({ name: TERMINAL_TAB_LABEL, hint: null });
    expect(labels.get("/work/acme/1")).toEqual({ name: "1", hint: null });
  });

  it("keeps terminal tabs open when their folder is removed", () => {
    const commit = commitTabPath("/work/acme/storefront", "a9f492bf");
    const tabPaths = ["/work/acme/a.ts", terminalTabPath(2), commit, "/work/other/b.ts"];
    expect(tabsInFolder(tabPaths, "/work/acme")).toEqual(["/work/acme/a.ts", commit]);
  });
});

describe("panelAfterLeave", () => {
  const terminals: PlacedTerminal[] = [
    { key: 1, location: "panel" },
    { key: 2, location: "editor" },
    { key: 3, location: "panel" },
    { key: 4, location: "panel" },
  ];

  it("shows the right neighbour among the panel's terminals when the shown one leaves", () => {
    expect(panelAfterLeave(terminals, 3, { activeKey: 3, panelOpen: true })).toEqual({ activeKey: 4, panelOpen: true });
    expect(panelAfterLeave(terminals, 4, { activeKey: 4, panelOpen: true })).toEqual({ activeKey: 3, panelOpen: true });
    expect(panelAfterLeave(terminals, 1, { activeKey: 1, panelOpen: false })).toEqual({ activeKey: 3, panelOpen: false });
  });

  it("keeps the shown terminal when another one leaves", () => {
    expect(panelAfterLeave(terminals, 4, { activeKey: 1, panelOpen: true })).toEqual({ activeKey: 1, panelOpen: true });
  });

  it("hides the panel with its last terminal, even with terminals in the editor", () => {
    const placed: PlacedTerminal[] = [
      { key: 1, location: "editor" },
      { key: 5, location: "panel" },
    ];
    expect(panelAfterLeave(placed, 5, { activeKey: 5, panelOpen: true })).toEqual({ activeKey: null, panelOpen: false });
  });

  it("leaves the panel alone when a terminal in the editor goes", () => {
    const state = { activeKey: 3, panelOpen: true };
    expect(panelAfterLeave(terminals, 2, state)).toBe(state);
    expect(panelAfterLeave(terminals, 99, state)).toBe(state);
  });
});

describe("terminalPlacement", () => {
  it("parks a terminal while nothing on screen can show it", () => {
    expect(terminalPlacement("panel", true)).toBe("panel");
    expect(terminalPlacement("editor", true)).toBe("editor");
    expect(terminalPlacement("panel", false)).toBe("parked");
    expect(terminalPlacement("editor", false)).toBe("parked");
  });
});

describe("panelAfterLeave with split terminals", () => {
  const split: PlacedTerminal[] = [
    { key: 1, location: "panel", group: 1 },
    { key: 2, location: "panel", group: 2 },
    { key: 3, location: "panel", group: 2 },
    { key: 4, location: "panel", group: 2 },
    { key: 5, location: "panel", group: 3 },
  ];

  it("hands over to the pane beside it, so the group stays on screen", () => {
    expect(panelAfterLeave(split, 4, { activeKey: 4, panelOpen: true })).toEqual({ activeKey: 3, panelOpen: true });
    expect(panelAfterLeave(split, 2, { activeKey: 2, panelOpen: true })).toEqual({ activeKey: 3, panelOpen: true });
    expect(panelAfterLeave(split, 3, { activeKey: 3, panelOpen: true })).toEqual({ activeKey: 4, panelOpen: true });
  });

  it("uses the usual rule for a terminal alone in its group", () => {
    expect(panelAfterLeave(split, 5, { activeKey: 5, panelOpen: true })).toEqual({ activeKey: 4, panelOpen: true });
    expect(panelAfterLeave(split, 1, { activeKey: 1, panelOpen: true })).toEqual({ activeKey: 2, panelOpen: true });
  });

  it("keeps the shown terminal when another pane leaves", () => {
    expect(panelAfterLeave(split, 3, { activeKey: 1, panelOpen: true })).toEqual({ activeKey: 1, panelOpen: true });
  });
});
