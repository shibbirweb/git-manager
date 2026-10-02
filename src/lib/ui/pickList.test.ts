import { describe, expect, it } from "vitest";
import { initialPick, type PickItem, pickRows, stepPick } from "./pickList";

const items: PickItem[] = [
  { value: "create", label: "+ Create Branch...", pinned: true },
  { value: "local:main", label: "main", description: "current", group: "Branches", disabled: true },
  { value: "local:feature/login", label: "feature/login", group: "Branches" },
  { value: "remote:origin/main", label: "origin/main", group: "Remote Branches" },
];

function shown(query: string): string[] {
  return pickRows(items, query).map((row) => (row.kind === "group" ? `# ${row.label}` : row.item.value));
}

describe("pick rows", () => {
  it("lists everything under group headings", () => {
    expect(shown("")).toEqual(["create", "# Branches", "local:main", "local:feature/login", "# Remote Branches", "remote:origin/main"]);
  });

  it("filters by every word, case-insensitively, keeping pinned items", () => {
    expect(shown("MAIN")).toEqual(["create", "# Branches", "local:main", "# Remote Branches", "remote:origin/main"]);
    expect(shown("origin main")).toEqual(["create", "# Remote Branches", "remote:origin/main"]);
    expect(shown("current")).toEqual(["create", "# Branches", "local:main"]);
    expect(shown("nothing")).toEqual(["create"]);
  });

  it("highlights the first real match once something is typed", () => {
    expect(initialPick(pickRows(items, ""), "")).toBe(0);
    const rows = pickRows(items, "login");
    expect(initialPick(rows, "login")).toBe(2);
    expect(initialPick(pickRows(items, "zzz"), "zzz")).toBe(0);
    expect(initialPick([], "")).toBe(-1);
  });

  it("steps over headings and disabled items, stopping at the ends", () => {
    const rows = pickRows(items, "");
    expect(stepPick(rows, 0, 1)).toBe(3);
    expect(stepPick(rows, 3, 1)).toBe(5);
    expect(stepPick(rows, 5, 1)).toBe(5);
    expect(stepPick(rows, 3, -1)).toBe(0);
    expect(stepPick(rows, 0, -1)).toBe(0);
  });
});
