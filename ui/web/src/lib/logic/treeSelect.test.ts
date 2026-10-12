import { describe, expect, it } from "vitest";
import { selectRow } from "./treeSelect";

const order = ["a", "b", "c", "d", "e"];
const none = { toggle: false, range: false };

describe("selectRow", () => {
  it("selects one row on a plain click", () => {
    expect(selectRow(order, { ids: ["a", "b"], anchor: "a" }, "c", none)).toEqual({ ids: ["c"], anchor: "c" });
  });

  it("adds and removes rows with Cmd or Ctrl", () => {
    const toggle = { toggle: true, range: false };
    expect(selectRow(order, { ids: ["a"], anchor: "a" }, "c", toggle)).toEqual({ ids: ["a", "c"], anchor: "c" });
    expect(selectRow(order, { ids: ["a", "c"], anchor: "c" }, "a", toggle)).toEqual({ ids: ["c"], anchor: "a" });
  });

  it("selects a range from the anchor with Shift, in either direction", () => {
    const range = { toggle: false, range: true };
    expect(selectRow(order, { ids: ["b"], anchor: "b" }, "d", range)).toEqual({ ids: ["b", "c", "d"], anchor: "b" });
    expect(selectRow(order, { ids: ["d"], anchor: "d" }, "b", range)).toEqual({ ids: ["b", "c", "d"], anchor: "d" });
    expect(selectRow(order, { ids: [], anchor: null }, "b", range)).toEqual({ ids: ["b"], anchor: "b" });
  });
});
