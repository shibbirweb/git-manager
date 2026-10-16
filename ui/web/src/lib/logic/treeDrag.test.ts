import { describe, expect, it } from "vitest";
import { AUTO_SCROLL_EDGE, dragText, treeDropTarget, treeParents, treeScrollStep } from "./treeDrag";

const nodes = [
  {
    id: "src",
    label: "src",
    children: [
      { id: "src/lib", label: "lib", children: [{ id: "src/lib/cart.ts", label: "cart.ts" }] },
      { id: "src/main.ts", label: "main.ts" },
    ],
  },
  { id: "README.md", label: "README.md" },
];
const parents = treeParents(nodes);
const folders = new Set(["src", "src/lib"]);
const isFolder = (id: string) => folders.has(id);

describe("treeParents", () => {
  it("maps every node to its parent, null at the top", () => {
    expect(parents.get("src/lib/cart.ts")).toBe("src/lib");
    expect(parents.get("src")).toBeNull();
    expect(parents.get("README.md")).toBeNull();
  });
});

describe("treeDropTarget", () => {
  it("drops into a folder, a file's folder, or the top level", () => {
    expect(treeDropTarget({ rowId: "src/lib", inside: true }, ["README.md"], "move", parents, isFolder)).toBe(
      "src/lib",
    );
    expect(treeDropTarget({ rowId: "src/main.ts", inside: true }, ["README.md"], "move", parents, isFolder)).toBe(
      "src",
    );
    expect(treeDropTarget({ rowId: null, inside: true }, ["src/main.ts"], "move", parents, isFolder)).toBeNull();
  });

  it("refuses outside the tree, into a dragged folder or below it, and a move to the same folder", () => {
    expect(treeDropTarget({ rowId: "src", inside: false }, ["README.md"], "move", parents, isFolder)).toBeUndefined();
    expect(treeDropTarget({ rowId: "src/lib", inside: true }, ["src"], "move", parents, isFolder)).toBeUndefined();
    expect(treeDropTarget({ rowId: "src/lib", inside: true }, ["src/lib"], "copy", parents, isFolder)).toBeUndefined();
    expect(
      treeDropTarget({ rowId: "src/main.ts", inside: true }, ["src/main.ts"], "move", parents, isFolder),
    ).toBeUndefined();
  });

  it("allows a copy into the same folder", () => {
    expect(treeDropTarget({ rowId: "src/main.ts", inside: true }, ["src/main.ts"], "copy", parents, isFolder)).toBe(
      "src",
    );
  });
});

describe("treeScrollStep", () => {
  it("scrolls near the edges, faster closer to them, and stops far off", () => {
    expect(treeScrollStep(300, 100, 500)).toBe(0);
    expect(treeScrollStep(105, 100, 500)).toBeLessThan(0);
    expect(treeScrollStep(495, 100, 500)).toBeGreaterThan(0);
    expect(treeScrollStep(100, 100, 500)).toBeLessThan(treeScrollStep(100 + AUTO_SCROLL_EDGE - 4, 100, 500));
    expect(treeScrollStep(40, 100, 500)).toBe(0);
  });
});

describe("dragText", () => {
  it("names one row or counts several, with the mode", () => {
    expect(dragText(["cart.ts"], "move")).toBe("Move cart.ts");
    expect(dragText(["a", "b", "c"], "copy")).toBe("Copy 3 items");
  });
});
