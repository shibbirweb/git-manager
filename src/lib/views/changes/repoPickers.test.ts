import { describe, expect, it } from "vitest";
import type { Refs, StashEntry } from "$lib/types";
import {
  checkoutPickItems,
  decodeRefPick,
  encodeRefPick,
  pickedStash,
  refPickItems,
  stashPickItems,
  tagPickItems,
  validateTagName,
} from "./repoPickers";

const refs: Refs = {
  local: [
    { name: "feature", isHead: false, upstream: null, ahead: 0, behind: 0, shortId: "1111111" },
    { name: "main", isHead: true, upstream: "origin/main", ahead: 0, behind: 0, shortId: "2222222" },
  ],
  remote: [{ name: "origin/main", remote: "origin", branch: "main" }],
  tags: ["v1.0"],
  remotes: ["origin"],
};

describe("ref picks", () => {
  it("round-trips through the picked value, names with colons included", () => {
    for (const pick of [
      { kind: "create" },
      { kind: "createFrom" },
      { kind: "local", name: "feature/a:b" },
      { kind: "remote", name: "origin/main" },
      { kind: "tag", name: "v1.0" },
    ] as const) {
      expect(decodeRefPick(encodeRefPick(pick))).toEqual(pick);
    }
    expect(decodeRefPick(null)).toBeNull();
    expect(decodeRefPick("other")).toBeNull();
  });

  it("lists Create entries first, then branches, remote branches and tags", () => {
    const items = checkoutPickItems(refs);
    expect(items.map((item) => item.label)).toEqual([
      "+ Create Branch...",
      "+ Create Branch From...",
      "feature",
      "main",
      "origin/main",
      "v1.0",
    ]);
    expect(items.slice(0, 2).every((item) => item.pinned)).toBe(true);
    expect(items.map((item) => item.group ?? null)).toEqual([null, null, "Branches", "Branches", "Remote Branches", "Tags"]);
    const current = items.find((item) => item.label === "main");
    expect(current?.disabled).toBe(true);
    expect(current?.description).toBe("current  origin/main  2222222");
  });

  it("leaves out the current branch when asked", () => {
    expect(refPickItems(refs, { skipCurrent: true }).map((item) => item.label)).toEqual(["feature"]);
    expect(refPickItems(null, { remote: true, tags: true })).toEqual([]);
  });
});

describe("stash and tag picks", () => {
  const stashes: StashEntry[] = [
    { index: 0, message: "On main: WIP", shortId: "aaaaaaa" },
    { index: 1, message: "", shortId: "bbbbbbb" },
  ];

  it("lists stashes by message and finds the picked one", () => {
    expect(stashPickItems(stashes).map((item) => [item.value, item.label, item.description])).toEqual([
      ["0", "On main: WIP", "stash@{0}  aaaaaaa"],
      ["1", "stash@{1}", "stash@{1}  bbbbbbb"],
    ]);
    expect(pickedStash(stashes, "1")?.shortId).toBe("bbbbbbb");
    expect(pickedStash(stashes, null)).toBeNull();
    expect(pickedStash(stashes, "7")).toBeNull();
  });

  it("lists tags", () => {
    expect(tagPickItems(["a", "b"])).toEqual([
      { value: "a", label: "a" },
      { value: "b", label: "b" },
    ]);
  });

  it("validates tag names", () => {
    expect(validateTagName("v1.2.3", [])).toBeNull();
    expect(validateTagName("release/2026", [])).toBeNull();
    expect(validateTagName("v1.0", ["v1.0"])).toBe("A tag with this name already exists");
    for (const bad of ["", "has space", "-x", "a..b", "a~1", "end.", "x.lock", "@", "a@{b"]) {
      expect(validateTagName(bad, []), bad).toBe("Not a valid tag name");
    }
  });
});
