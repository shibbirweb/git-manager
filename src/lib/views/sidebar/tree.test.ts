import { describe, expect, it } from "vitest";
import type { LocalBranch, Refs } from "$lib/types";
import { buildRows, type SidebarRow } from "./tree";

function branch(name: string): LocalBranch {
  return { name, isHead: false, upstream: null, ahead: 0, behind: 0, shortId: null };
}

function refsOf(localNames: string[], remoteNames: string[] = []): Refs {
  return {
    local: localNames.map(branch),
    remote: remoteNames.map((name) => ({ name: `origin/${name}`, remote: "origin", branch: name })),
    tags: [],
    remotes: ["origin"],
  };
}

function labels(rows: SidebarRow[], kind: SidebarRow["kind"]): string[] {
  return rows.flatMap((row) => (row.kind === kind && "label" in row ? [row.label] : []));
}

describe("buildRows", () => {
  it("sorts branch and folder names in natural order, numbers by value", () => {
    const rows = buildRows({
      refs: refsOf(["fix-10", "fix-9", "Fix-2", "release/v10", "release/v2", "feature/b", "feature/a"]),
      stashes: [],
      filter: "",
      isExpanded: () => true,
    });
    expect(labels(rows, "group")).toEqual(["feature", "release", "origin"]);
    expect(labels(rows, "local")).toEqual(["a", "b", "v2", "v10", "Fix-2", "fix-9", "fix-10"]);
  });

  it("keeps remote branches under their remote, filtered by name", () => {
    const rows = buildRows({
      refs: refsOf(["main"], ["main", "topic/2", "topic/11"]),
      stashes: [],
      filter: "topic",
      isExpanded: () => true,
    });
    expect(labels(rows, "section")).toEqual(["Remote"]);
    expect(labels(rows, "remote")).toEqual(["2", "11"]);
  });
});
