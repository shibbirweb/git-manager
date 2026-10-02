import { describe, expect, it } from "vitest";
import {
  groupMembers,
  groupRowPosition,
  normalizeSizes,
  resizePanes,
  sizesAfterClose,
  sizesAfterSplit,
  terminalGroups,
} from "./splitPanes";

const terminals = [
  { key: 1, group: 1 },
  { key: 4, group: 1 },
  { key: 2, group: 2 },
  { key: 3, group: 3 },
  { key: 5, group: 3 },
  { key: 6, group: 3 },
];

describe("terminalGroups", () => {
  it("groups the terminals in list order", () => {
    expect(terminalGroups(terminals)).toEqual([
      { group: 1, terminalKeys: [1, 4] },
      { group: 2, terminalKeys: [2] },
      { group: 3, terminalKeys: [3, 5, 6] },
    ]);
    expect(terminalGroups([])).toEqual([]);
  });

  it("finds a terminal's group members", () => {
    expect(groupMembers(terminals, 5)).toEqual([3, 5, 6]);
    expect(groupMembers(terminals, 2)).toEqual([2]);
    expect(groupMembers(terminals, 99)).toEqual([]);
  });

  it("places each row in its group for the tree lines", () => {
    const [first, single, third] = terminalGroups(terminals);
    expect(groupRowPosition(single, 2)).toBe("single");
    expect(groupRowPosition(first, 1)).toBe("first");
    expect(groupRowPosition(first, 4)).toBe("last");
    expect(groupRowPosition(third, 5)).toBe("middle");
  });
});

describe("pane sizes", () => {
  it("uses saved sizes only when they fit", () => {
    expect(normalizeSizes([0.3, 0.7], 2)).toEqual([0.3, 0.7]);
    expect(normalizeSizes([0.3, 0.7], 3)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(normalizeSizes(undefined, 2)).toEqual([0.5, 0.5]);
    expect(normalizeSizes([0.3, 0.3], 2)).toEqual([0.5, 0.5]);
    expect(normalizeSizes([Number.NaN, 1], 2)).toEqual([0.5, 0.5]);
    expect(normalizeSizes([], 0)).toEqual([]);
  });

  it("halves the split pane and puts the new one right of it", () => {
    expect(sizesAfterSplit([1], 0)).toEqual([0.5, 0.5]);
    expect(sizesAfterSplit([0.6, 0.4], 0)).toEqual([0.3, 0.3, 0.4]);
    expect(sizesAfterSplit([], 0)).toEqual([0.5, 0.5]);
  });

  it("gives a closed pane's width to its neighbor, so the other one widens", () => {
    expect(sizesAfterClose([0.5, 0.5], 1)).toEqual([1]);
    expect(sizesAfterClose([0.25, 0.25, 0.5], 0)).toEqual([0.5, 0.5]);
    expect(sizesAfterClose([0.25, 0.25, 0.5], 2)).toEqual([0.25, 0.75]);
    expect(sizesAfterClose([1], 0)).toEqual([]);
    expect(sizesAfterClose([0.5, 0.5], 5)).toEqual([0.5, 0.5]);
  });

  it("moves width between the two panes beside a divider, keeping a minimum", () => {
    expect(resizePanes([0.5, 0.5], 0, 0.1, 0.1)[0]).toBeCloseTo(0.6);
    const clamped = resizePanes([0.5, 0.5], 0, 0.9, 0.1);
    expect(clamped[0]).toBeCloseTo(0.9);
    expect(clamped[1]).toBeCloseTo(0.1);
    expect(resizePanes([0.5, 0.5], 0, -0.9, 0.1)).toEqual([0.1, 0.9]);
    const three = resizePanes([0.2, 0.3, 0.5], 1, 0.1, 0.1);
    expect(three[0]).toBe(0.2);
    expect(three[1]).toBeCloseTo(0.4);
    expect(three[2]).toBeCloseTo(0.4);
    expect(resizePanes([0.5, 0.5], 1, 0.1, 0.1)).toEqual([0.5, 0.5]);
    expect(resizePanes([0.5, 0.5], 0, Number.NaN, 0.1)).toEqual([0.5, 0.5]);
  });
});
