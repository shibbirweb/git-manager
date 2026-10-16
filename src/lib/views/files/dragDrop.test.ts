import { describe, expect, it } from "vitest";
import { checkDrop, dropPointToCss } from "./dragDrop";
import cases from "./nameRules.cases.json";

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

describe("dropPointToCss", () => {
  it("keeps macOS drop points and scales device pixels elsewhere", () => {
    expect(dropPointToCss({ x: 200, y: 100 }, 2, "macos")).toEqual({ x: 200, y: 100 });
    expect(dropPointToCss({ x: 200, y: 100 }, 2, "windows")).toEqual({ x: 100, y: 50 });
    expect(dropPointToCss({ x: 200, y: 100 }, 0, "linux")).toEqual({ x: 200, y: 100 });
  });
});
