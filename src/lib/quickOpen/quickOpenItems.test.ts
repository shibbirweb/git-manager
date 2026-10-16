import { describe, expect, it } from "vitest";
import { quickOpenItems } from "./quickOpenItems";
import type { QuickRow } from "./quickOpenModel";

describe("quickOpenItems", () => {
  it("gives the rows under a heading its section", () => {
    const rows: QuickRow[] = [
      { kind: "header", key: "h:recent", label: "recently opened" },
      {
        kind: "file",
        key: "f:a",
        file: {
          path: "/w/src/cart.ts",
          name: "cart.ts",
          nameParts: [
            { text: "ca", match: true },
            { text: "rt.ts", match: false },
          ],
          folderParts: [{ text: "w/src", match: false }],
        },
      },
    ];
    const { items, empty, rows: byId } = quickOpenItems(rows);
    expect(empty).toBe("");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "f:a",
      title: "cart.ts",
      ranges: [[0, 2]],
      folder: "w/src",
      tooltip: "/w/src/cart.ts",
      section: "recently opened",
    });
    expect(byId.get("f:a")?.kind).toBe("file");
  });

  it("turns a lone message, or a line out of range, into the empty text", () => {
    expect(quickOpenItems([{ kind: "message", key: "message", label: "No files match" }])).toMatchObject({
      items: [],
      empty: "No files match",
    });
    const line: QuickRow = { kind: "line", key: "line", label: "Line 900 is past the end", target: null };
    expect(quickOpenItems([line]).empty).toBe("Line 900 is past the end");
  });

  it("keeps a line that can be gone to, and the help prefixes", () => {
    const { items } = quickOpenItems([
      { kind: "line", key: "line", label: "Go to line 4", target: { line: 4, column: 1 } },
      { kind: "help", key: "help:commands", prefix: ">", label: "Run a command" },
    ]);
    expect(items.map((item) => [item.icon, item.prefix])).toEqual([
      ["arrow-right", undefined],
      [undefined, ">"],
    ]);
  });
});
