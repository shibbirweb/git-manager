import { describe, expect, it } from "vitest";
import type { SymbolSearchItem } from "$lib/types";
import { KIND_INFO, symbolRows } from "./symbolSearchModel";

function item(overrides: Partial<SymbolSearchItem> = {}): SymbolSearchItem {
  return {
    name: "add",
    kind: "method",
    container: "Cart",
    path: "/w/src/cart.ts",
    root: "/w",
    relativePath: "src/cart.ts",
    line: 42,
    column: 3,
    indices: [0, 1],
    containerIndices: [],
    score: 1,
    ...overrides,
  };
}

const one = [{ root: "/w", name: "w" }];
const two = [
  { root: "/w", name: "w" },
  { root: "/other", name: "other" },
];

describe("symbolRows", () => {
  it("highlights the name, shows the container and the file with its line", () => {
    const [row] = symbolRows([item()], one);
    expect(row.kind).toEqual(KIND_INFO.method);
    expect(row.nameParts).toEqual([
      { text: "ad", match: true },
      { text: "d", match: false },
    ]);
    expect(row.containerParts).toEqual([{ text: "Cart", match: false }]);
    expect(row.location).toBe("cart.ts:42");
    expect(row.title).toBe("src/cart.ts:42");
    expect(row.key).toBe("/w/src/cart.ts:42:3:add");
  });

  it("highlights the container of a dotted query and leaves it out when there is none", () => {
    expect(symbolRows([item({ containerIndices: [0] })], one)[0].containerParts[0]).toEqual({ text: "C", match: true });
    expect(symbolRows([item({ container: null, kind: "function" })], one)[0].containerParts).toEqual([]);
  });

  it("leads the title with the workspace folder only when there are several", () => {
    expect(symbolRows([item({ root: "/other", path: "/other/src/cart.ts" })], two)[0].title).toBe("other/src/cart.ts:42");
  });

  it("gives every kind a letter", () => {
    expect(KIND_INFO.class.letter).toBe("C");
    expect(KIND_INFO.interface.letter).toBe("I");
    expect(KIND_INFO.enum.letter).toBe("E");
    expect(KIND_INFO.type.letter).toBe("T");
    expect(KIND_INFO.function.letter).toBe("F");
    expect(KIND_INFO.method.letter).toBe("M");
    expect(KIND_INFO.constant.letter).toBe("K");
  });
});
