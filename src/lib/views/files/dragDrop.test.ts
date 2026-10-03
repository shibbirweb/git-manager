import { describe, expect, it } from "vitest";
import { AUTO_SCROLL_EDGE_PX, autoScrollStep, DRAG_THRESHOLD_PX, checkDrop, dragLabel, dropFolder, dropPointToCss, pastDragThreshold } from "./dragDrop";
import cases from "./nameRules.cases.json";

describe("dropFolder", () => {
  it("drops into a folder, or into the folder of a file", () => {
    expect(dropFolder({ path: "/w/src", isDir: true }, "/w")).toBe("/w/src");
    expect(dropFolder({ path: "/w/src/cart.ts", isDir: false }, "/w")).toBe("/w/src");
  });

  it("drops off the rows into the single workspace folder, if there is one", () => {
    expect(dropFolder(null, "/w")).toBe("/w");
    expect(dropFolder(null, null)).toBeNull();
  });
});

describe("checkDrop", () => {
  it("follows the shared rule table; clashes are left to the backend's dry run", () => {
    for (const moveCase of cases.moves) {
      const expected = moveCase.result.startsWith("clash:") ? "ok" : moveCase.result;
      const sources = moveCase.sources.map((source) => source.path);
      expect(checkDrop(sources, moveCase.target, "move"), moveCase.about).toBe(expected);
    }
  });

  it("allows moves and copies into another folder", () => {
    expect(checkDrop(["/w/src/cart.ts", "/w/README.md"], "/w/lib", "move")).toBe("ok");
    expect(checkDrop(["/w/src"], "/w/lib", "copy")).toBe("ok");
  });

  it("refuses a folder into itself or a folder inside it", () => {
    expect(checkDrop(["/w/src"], "/w/src", "move")).toBe("intoItself");
    expect(checkDrop(["/w/src"], "/w/src/lib", "copy")).toBe("intoItself");
    expect(checkDrop(["/w/src"], "/w/srcx", "move")).toBe("ok");
  });

  it("skips a move into the folder the items are already in, but copies there", () => {
    expect(checkDrop(["/w/src/a.ts", "/w/src/b.ts"], "/w/src", "move")).toBe("noop");
    expect(checkDrop(["/w/src/a.ts", "/w/b.ts"], "/w/src", "move")).toBe("ok");
    expect(checkDrop(["/w/src/a.ts"], "/w/src", "copy")).toBe("ok");
    expect(checkDrop([], "/w/src", "copy")).toBe("noop");
  });
});

describe("pastDragThreshold", () => {
  it("turns a press into a drag only after a few pixels", () => {
    expect(pastDragThreshold({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(false);
    expect(pastDragThreshold({ x: 10, y: 10 }, { x: 10, y: 10 + DRAG_THRESHOLD_PX })).toBe(true);
  });
});

describe("autoScrollStep", () => {
  it("scrolls up near the top and down near the bottom, faster at the edge", () => {
    expect(autoScrollStep(300, 100, 500)).toBe(0);
    expect(autoScrollStep(100, 100, 500)).toBeLessThan(autoScrollStep(100 + AUTO_SCROLL_EDGE_PX - 4, 100, 500));
    expect(autoScrollStep(110, 100, 500)).toBeLessThan(0);
    expect(autoScrollStep(495, 100, 500)).toBeGreaterThan(0);
    expect(autoScrollStep(80, 100, 500)).toBe(autoScrollStep(100, 100, 500));
    expect(autoScrollStep(40, 100, 500)).toBe(0);
    expect(autoScrollStep(560, 100, 500)).toBe(0);
  });
});

describe("labels and positions", () => {
  it("names what is dragged", () => {
    expect(dragLabel(["cart.ts"], "move")).toBe("Move cart.ts");
    expect(dragLabel(["a.ts", "b.ts", "lib"], "copy")).toBe("Copy 3 items");
  });

  it("keeps macOS drop points and scales device pixels elsewhere", () => {
    expect(dropPointToCss({ x: 200, y: 100 }, 2, "macos")).toEqual({ x: 200, y: 100 });
    expect(dropPointToCss({ x: 200, y: 100 }, 2, "windows")).toEqual({ x: 100, y: 50 });
    expect(dropPointToCss({ x: 200, y: 100 }, 0, "linux")).toEqual({ x: 200, y: 100 });
  });
});
