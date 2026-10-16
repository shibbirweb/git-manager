import { describe, expect, it } from "vitest";
import { treeKey, treeRows, type TreeNode } from "./treeModel";

const nodes: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      { id: "src/lib", label: "lib", children: [{ id: "src/lib/a.ts", label: "a.ts" }] },
      { id: "src/main.ts", label: "main.ts" },
    ],
  },
  { id: "empty", label: "empty", children: [] },
  { id: "README.md", label: "README.md" },
];

describe("treeRows", () => {
  it("lists open folders' children after them, with their depth", () => {
    const rows = treeRows(nodes, new Set(["src"]));
    expect(rows.map((row) => [row.node.id, row.depth, row.isFolder, row.expanded])).toEqual([
      ["src", 0, true, true],
      ["src/lib", 1, true, false],
      ["src/main.ts", 1, false, false],
      ["empty", 0, true, false],
      ["README.md", 0, false, false],
    ]);
  });

  it("ignores open ids whose folder is closed above them", () => {
    expect(treeRows(nodes, new Set(["src/lib"])).map((row) => row.node.id)).toEqual(["src", "empty", "README.md"]);
  });
});

describe("treeKey", () => {
  const rows = treeRows(nodes, new Set(["src", "src/lib"]));

  it("moves within the rows", () => {
    expect(treeKey(rows, 0, "ArrowDown")).toEqual({ kind: "select", index: 1 });
    expect(treeKey(rows, 5, "ArrowDown")).toEqual({ kind: "select", index: 5 });
    expect(treeKey(rows, 0, "ArrowUp")).toEqual({ kind: "select", index: 0 });
    expect(treeKey(rows, 3, "End")).toEqual({ kind: "select", index: 5 });
  });

  it("opens and enters folders with Right, closes or goes up with Left", () => {
    expect(treeKey(rows, 0, "ArrowRight")).toEqual({ kind: "select", index: 1 });
    expect(treeKey(rows, 4, "ArrowRight")).toEqual({ kind: "expand", id: "empty" });
    expect(treeKey(rows, 1, "ArrowLeft")).toEqual({ kind: "collapse", id: "src/lib" });
    expect(treeKey(rows, 2, "ArrowLeft")).toEqual({ kind: "select", index: 1 });
    expect(treeKey(rows, 0, "ArrowLeft")).toEqual({ kind: "collapse", id: "src" });
    expect(treeKey(rows, 5, "ArrowRight")).toBeNull();
  });

  it("opens files and toggles folders with Enter, and ignores other keys", () => {
    expect(treeKey(rows, 2, "Enter")).toEqual({ kind: "open", id: "src/lib/a.ts" });
    expect(treeKey(rows, 0, "Enter")).toEqual({ kind: "collapse", id: "src" });
    expect(treeKey(rows, 0, "x")).toBeNull();
    expect(treeKey([], -1, "ArrowDown")).toBeNull();
  });
});
