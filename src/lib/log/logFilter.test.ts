import { describe, expect, it } from "vitest";
import type { CommitSummary } from "$lib/types";
import { countLabel, matchesQuery, matchingEntries, refChips } from "./logFilter";

function commit(id: string, summary: string, authorName = "Ada Lovelace"): CommitSummary {
  return {
    id,
    shortId: id.slice(0, 7),
    summary,
    authorName,
    authorEmail: `${authorName.split(" ")[0].toLowerCase()}@example.com`,
    time: 0,
    parents: [],
    refs: [],
  };
}

describe("matchesQuery", () => {
  const tax = commit("a1b2c3d4", "Round Tax to cents", "Alan Turing");

  it("matches the start of the hash only", () => {
    expect(matchesQuery(tax, "a1b2")).toBe(true);
    expect(matchesQuery(tax, "b2c3")).toBe(false);
  });

  it("matches the subject, author name and email anywhere, ignoring case", () => {
    expect(matchesQuery(tax, "tax to")).toBe(true);
    expect(matchesQuery(tax, "turing")).toBe(true);
    expect(matchesQuery(tax, "alan@")).toBe(true);
    expect(matchesQuery(tax, "cart")).toBe(false);
  });
});

describe("matchingEntries", () => {
  const entries = [commit("aaa", "Add cart"), commit("bbb", "Fix tax"), commit("ccc", "Cart totals")].map((item) => ({
    commit: item,
  }));

  it("is null without a filter", () => {
    expect(matchingEntries(entries, "")).toBeNull();
  });

  it("lists the matching entries in order", () => {
    expect(matchingEntries(entries, "cart")).toEqual([entries[0], entries[2]]);
    expect(matchingEntries(entries, "nothing")).toEqual([]);
  });
});

describe("countLabel", () => {
  it("counts loaded commits, with a plus while more can load", () => {
    expect(countLabel(1, false, null)).toBe("1 commit");
    expect(countLabel(300, true, null)).toBe("300+ commits");
  });

  it("says how many loaded commits match a filter", () => {
    expect(countLabel(300, true, 4)).toBe("4 of 300+ loaded commits");
  });
});

describe("refChips", () => {
  const refs = [
    { name: "main", kind: "head" as const },
    { name: "origin/main", kind: "remote" as const },
    { name: "v1.0", kind: "tag" as const },
    { name: "v1.1", kind: "tag" as const },
  ];

  it("shows every ref when there is room", () => {
    expect(refChips(refs.slice(0, 3), 3)).toEqual({ shown: refs.slice(0, 3), more: null });
  });

  it("folds the rest into one chip that names them", () => {
    expect(refChips(refs, 2)).toEqual({ shown: refs.slice(0, 2), more: { count: 2, names: "v1.0, v1.1" } });
  });
});
