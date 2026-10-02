import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  extendSelection,
  retargetSelection,
  rowAfterRemoval,
  selectAll,
  selectedInOrder,
  selectOnly,
  selectRange,
  toggleSelected,
  topLevel,
} from "./selection";

const order = ["/w/src", "/w/src/a.ts", "/w/src/b.ts", "/w/src/c.ts", "/w/README.md"];

function selected(selection: { paths: ReadonlySet<string> }): string[] {
  return selectedInOrder({ paths: selection.paths, anchor: null, focus: null }, order);
}

describe("clicks", () => {
  it("selects one row on a plain click", () => {
    const selection = selectOnly("/w/src/a.ts");
    expect(selected(selection)).toEqual(["/w/src/a.ts"]);
    expect(selection.anchor).toBe("/w/src/a.ts");
    expect(selectOnly(null)).toBe(EMPTY_SELECTION);
  });

  it("toggles rows with Cmd-click and moves the anchor there", () => {
    let selection = selectOnly("/w/src/a.ts");
    selection = toggleSelected(selection, "/w/src/c.ts");
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/c.ts"]);
    expect(selection.anchor).toBe("/w/src/c.ts");
    selection = toggleSelected(selection, "/w/src/a.ts");
    expect(selected(selection)).toEqual(["/w/src/c.ts"]);
  });

  it("selects the range from the anchor with Shift-click, in either direction", () => {
    let selection = selectRange(selectOnly("/w/src/a.ts"), order, "/w/src/c.ts");
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/b.ts", "/w/src/c.ts"]);
    selection = selectRange(selection, order, "/w/src");
    expect(selected(selection)).toEqual(["/w/src", "/w/src/a.ts"]);
    expect(selection.anchor).toBe("/w/src/a.ts");
    expect(selection.focus).toBe("/w/src");
  });

  it("starts a range from a Cmd-clicked row", () => {
    const selection = selectRange(toggleSelected(selectOnly("/w/src"), "/w/src/c.ts"), order, "/w/README.md");
    expect(selected(selection)).toEqual(["/w/src/c.ts", "/w/README.md"]);
  });

  it("selects only the clicked row when the anchor is gone", () => {
    expect(selected(selectRange(selectOnly("/w/gone.ts"), order, "/w/src/b.ts"))).toEqual(["/w/src/b.ts"]);
    const unchanged = selectOnly("/w/src/a.ts");
    expect(selectRange(unchanged, order, "/w/hidden.ts")).toBe(unchanged);
  });

  it("selects several new rows at once", () => {
    const selection = selectAll(["/w/src/a.ts", "/w/src/b.ts"]);
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/b.ts"]);
    expect(selection.focus).toBe("/w/src/b.ts");
    expect(selectAll([])).toBe(EMPTY_SELECTION);
  });
});

describe("extendSelection", () => {
  it("grows and shrinks the range with Shift+Down and Shift+Up", () => {
    let selection = selectOnly("/w/src/b.ts");
    selection = extendSelection(selection, order, 1);
    selection = extendSelection(selection, order, 1);
    expect(selected(selection)).toEqual(["/w/src/b.ts", "/w/src/c.ts", "/w/README.md"]);
    selection = extendSelection(selection, order, 1);
    expect(selection.focus).toBe("/w/README.md");
    selection = extendSelection(selection, order, -1);
    selection = extendSelection(selection, order, -1);
    selection = extendSelection(selection, order, -1);
    expect(selected(selection)).toEqual(["/w/src/a.ts", "/w/src/b.ts"]);
  });

  it("starts at the first or last row when nothing has the focus", () => {
    expect(extendSelection(EMPTY_SELECTION, order, 1).focus).toBe("/w/src");
    expect(extendSelection(EMPTY_SELECTION, order, -1).focus).toBe("/w/README.md");
    expect(extendSelection(EMPTY_SELECTION, [], 1)).toBe(EMPTY_SELECTION);
  });
});

describe("topLevel", () => {
  it("drops paths inside another selected folder", () => {
    expect(topLevel(["/w/src", "/w/src/a.ts", "/w/srcx.ts", "/w/README.md"])).toEqual(["/w/src", "/w/srcx.ts", "/w/README.md"]);
  });
});

describe("retargetSelection", () => {
  it("follows renamed and moved rows", () => {
    const selection = retargetSelection(selectRange(selectOnly("/w/src"), order, "/w/src/a.ts"), [{ from: "/w/src", to: "/w/lib" }]);
    expect([...selection.paths]).toEqual(["/w/lib", "/w/lib/a.ts"]);
    expect(selection.anchor).toBe("/w/lib");
    expect(selection.focus).toBe("/w/lib/a.ts");
    expect(retargetSelection(EMPTY_SELECTION, []).focus).toBeNull();
  });
});

describe("rowAfterRemoval", () => {
  it("picks the next row below, else above", () => {
    expect(rowAfterRemoval(order, ["/w/src/b.ts"])).toBe("/w/src/c.ts");
    expect(rowAfterRemoval(order, ["/w/README.md"])).toBe("/w/src/c.ts");
    expect(rowAfterRemoval(order, ["/w/src"])).toBe("/w/README.md");
    expect(rowAfterRemoval(order, ["/w/src", "/w/README.md"])).toBeNull();
    expect(rowAfterRemoval(order, ["/w/other.ts"])).toBeNull();
  });
});
