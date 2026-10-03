import { EditorState, Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import type { BlameCommit } from "$lib/types";
import {
  ageRanks,
  commitAt,
  commitLineAt,
  commitLineTarget,
  fromInfo,
  isUncommitted,
  LOCAL_EDIT,
  mapBlame,
  UNKNOWN_LINE,
} from "./blameModel";

function commit(id: string, authorTime: number, uncommitted = false): BlameCommit {
  return { id, shortId: id.slice(0, 8), authorName: id, authorEmail: "", authorTime, summary: id, uncommitted };
}

const commits = [commit("a", 100), commit("b", 200)];

describe("fromInfo", () => {
  it("expands runs into one owner and origin per line", () => {
    // Lines 0-2 are lines 5-7 of commit a, lines 3-4 lines 0-1 of commit b.
    const state = fromInfo({ commits, runs: [3, 0, 5, 2, 1, 0] }, 5);
    expect(state.lines).toEqual([0, 0, 0, 1, 1]);
    expect(state.origins).toEqual([5, 6, 7, 0, 1]);
  });

  it("pads the empty line after a trailing newline", () => {
    const state = fromInfo({ commits, runs: [1, 0, 0, 1, 1, 0] }, 3);
    expect(state.lines).toEqual([0, 1, 1]);
  });

  it("trims extra lines", () => {
    expect(fromInfo({ commits, runs: [1, 0, 0, 2, 1, 0] }, 2).lines).toEqual([0, 1]);
  });

  it("treats a missing blame as local edits", () => {
    expect(fromInfo({ commits: [], runs: [] }, 2).lines).toEqual([LOCAL_EDIT, LOCAL_EDIT]);
  });
});

describe("mapBlame", () => {
  const doc = Text.of(["one", "two", "three", "four"]);
  const base = { commits, lines: [0, 0, 1, 1] };

  function edit(from: number, to: number, insert: string) {
    const tr = EditorState.create({ doc }).update({ changes: { from, to, insert } });
    return mapBlame(base, tr.changes, doc, tr.state.doc).lines;
  }

  it("marks an edited line as a local edit and keeps the rest", () => {
    expect(edit(doc.line(2).from, doc.line(2).to, "TWO")).toEqual([0, LOCAL_EDIT, 1, 1]);
  });

  it("shifts owners down when lines are inserted", () => {
    expect(edit(doc.line(1).to, doc.line(1).to, "\nnew")).toEqual([LOCAL_EDIT, LOCAL_EDIT, 0, 1, 1]);
  });

  it("drops owners of deleted lines", () => {
    expect(edit(doc.line(2).from, doc.line(3).from, "")).toEqual([0, LOCAL_EDIT, 1]);
  });
});

describe("helpers", () => {
  it("finds commits and uncommitted lines", () => {
    const state = { commits: [...commits, commit("0", 0, true)], lines: [0, LOCAL_EDIT, 2] };
    expect(commitAt(state, 0)?.id).toBe("a");
    expect(commitAt(state, 1)).toBeNull();
    expect(isUncommitted(state, 0)).toBe(false);
    expect(isUncommitted(state, 1)).toBe(true);
    expect(isUncommitted(state, 2)).toBe(true);
  });

  it("ranks commits by age", () => {
    expect(ageRanks([commit("old", 1), commit("mid", 5), commit("new", 9), commit("x", 0, true)])).toEqual([0, 0.5, 1, 1]);
  });
});

describe("commit-side lines", () => {
  const doc = Text.of(["one", "two", "three", "four"]);

  it("keeps git's original line numbers and pads unknown ones", () => {
    const state = fromInfo({ commits, runs: [1, 0, 4, 1, 1, 9] }, 3);
    expect(state.origins).toEqual([4, 9, UNKNOWN_LINE]);
    expect(commitLineAt(state, 1)).toBe(9);
    expect(commitLineAt(state, 2)).toBeNull();
  });

  it("has none for lines a state without origins does not know", () => {
    expect(commitLineAt({ commits, lines: [0, 1] }, 0)).toBeNull();
  });

  it("moves them with edits and forgets them on edited lines", () => {
    const base = { commits, lines: [0, 0, 1, 1], origins: [10, 11, 3, 4] };
    const tr = EditorState.create({ doc }).update({ changes: { from: doc.line(1).to, insert: "\nnew" } });
    expect(mapBlame(base, tr.changes, doc, tr.state.doc).origins).toEqual([UNKNOWN_LINE, UNKNOWN_LINE, 11, 3, 4]);
  });

  it("targets the commit's line when known, else the same line and its text", () => {
    const known = { commits, lines: [0, 1], origins: [7, UNKNOWN_LINE] };
    expect(commitLineTarget(known, 0, "one")).toEqual({ line: 7 });
    expect(commitLineTarget(known, 1, "two")).toEqual({ line: 1, lineText: "two" });
    expect(commitLineTarget({ commits, lines: [0] }, 0, "one")).toEqual({ line: 0, lineText: "one" });
  });
});
