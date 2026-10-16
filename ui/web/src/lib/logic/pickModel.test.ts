import { describe, expect, it } from "vitest";
import { initialPick, pickRows, stepPick, type PickItem } from "./pickModel";

const items: PickItem[] = [
  { value: "new", label: "Create new branch...", pinned: true },
  { value: "main", label: "main", description: "current", group: "Local" },
  { value: "dev", label: "develop", group: "Local" },
  { value: "old", label: "old-work", group: "Local", disabled: true },
  { value: "origin/main", label: "origin/main", group: "Remote" },
];

describe("pickRows", () => {
  it("lists everything with group headings when there is no filter", () => {
    expect(pickRows(items, "").map((row) => (row.kind === "group" ? `# ${row.label}` : row.item.value))).toEqual([
      "new",
      "# Local",
      "main",
      "dev",
      "old",
      "# Remote",
      "origin/main",
    ]);
  });

  it("keeps items with every word, in label or description, and pinned items", () => {
    expect(pickRows(items, "MAIN cur").map((row) => (row.kind === "group" ? row.label : row.item.value))).toEqual([
      "new",
      "Local",
      "main",
    ]);
  });
});

describe("moving", () => {
  const rows = pickRows(items, "");

  it("skips headings and disabled items, and stops at the ends", () => {
    expect(stepPick(rows, 0, 1)).toBe(2);
    expect(stepPick(rows, 3, 1)).toBe(6);
    expect(stepPick(rows, 6, 1)).toBe(6);
    expect(stepPick(rows, 2, -1)).toBe(0);
  });

  it("starts on the first unpinned match while filtering", () => {
    expect(initialPick(rows, "")).toBe(0);
    expect(initialPick(pickRows(items, "dev"), "dev")).toBe(2);
    expect(initialPick([], "x")).toBe(-1);
  });
});
