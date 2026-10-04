import { ChangeSet, EditorState, Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { findConflictsInDoc, resolveAllEdits, resolveEdit, updateConflicts } from "./conflictMarkers";

function doc(value: string): Text {
  return Text.of(value.split("\n"));
}

const mergeStyle = [
  "before",
  "<<<<<<< HEAD",
  "ours 1",
  "ours 2",
  "=======",
  "theirs",
  ">>>>>>> feature/login",
  "middle",
  "<<<<<<< HEAD",
  "a",
  "=======",
  "b",
  ">>>>>>> feature/login",
  "after",
].join("\n");

const diff3Style = ["x", "<<<<<<< ours", "mine", "||||||| base", "original", "=======", "yours", ">>>>>>> theirs", "y"].join("\n");

function resolve(text: string, index: number, choice: "current" | "incoming" | "both"): string {
  const document = doc(text);
  const region = findConflictsInDoc(document)[index];
  const edit = resolveEdit(document, region, choice);
  return ChangeSet.of(edit ? [edit] : [], document.length).apply(document).toString();
}

describe("findConflictsInDoc", () => {
  it("finds regions with labels", () => {
    const regions = findConflictsInDoc(doc(mergeStyle));
    expect(regions).toHaveLength(2);
    expect(regions[0]).toEqual({
      start: 1,
      baseMarker: null,
      separator: 4,
      end: 6,
      currentLabel: "HEAD",
      incomingLabel: "feature/login",
    });
    expect(regions[1].start).toBe(8);
  });

  it("understands diff3 base sections", () => {
    const [region] = findConflictsInDoc(doc(diff3Style));
    expect(region.baseMarker).toBe(3);
    expect(region.separator).toBe(5);
  });

  it("ignores incomplete and look-alike markers", () => {
    expect(findConflictsInDoc(doc("<<<<<<< HEAD\na\n=======\nb"))).toEqual([]);
    expect(findConflictsInDoc(doc("<<<<<<<<\na\n=======\nb\n>>>>>>>>"))).toEqual([]);
  });

  it("restarts at a new start marker", () => {
    const regions = findConflictsInDoc(doc("<<<<<<< a\nstray\n<<<<<<< b\nx\n=======\ny\n>>>>>>> c"));
    expect(regions).toHaveLength(1);
    expect(regions[0].start).toBe(2);
  });
});

describe("resolving", () => {
  it("accepts the current side", () => {
    expect(resolve(mergeStyle, 0, "current").split("\n").slice(0, 4)).toEqual(["before", "ours 1", "ours 2", "middle"]);
  });

  it("accepts the incoming side", () => {
    expect(resolve(mergeStyle, 0, "incoming").split("\n").slice(0, 3)).toEqual(["before", "theirs", "middle"]);
  });

  it("keeps both sides, current first", () => {
    expect(resolve(mergeStyle, 1, "both").split("\n").slice(-4)).toEqual(["middle", "a", "b", "after"]);
  });

  it("drops the base section in diff3 style", () => {
    expect(resolve(diff3Style, 0, "current")).toBe("x\nmine\ny");
    expect(resolve(diff3Style, 0, "incoming")).toBe("x\nyours\ny");
  });

  it("removes a region whose chosen side is empty", () => {
    expect(resolve("a\n<<<<<<< HEAD\n=======\nb\n>>>>>>> x\nc", 0, "current")).toBe("a\nc");
  });

  it("resolves all regions in one change set", () => {
    const document = doc(mergeStyle);
    const edits = resolveAllEdits(document, findConflictsInDoc(document), "incoming");
    expect(ChangeSet.of(edits, document.length).apply(document).toString()).toBe(
      ["before", "theirs", "middle", "b", "after"].join("\n"),
    );
  });
});

describe("updateConflicts", () => {
  const pieces = ["text", "<<<<<<< HEAD", "<<<<", "<<<", "=======", "===", ">>>>>>> x", ">>>", "||||||| base", "\n", "a\nb"];

  it("matches a full scan after random edits", () => {
    let seed = 3;
    const random = (bound: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };
    let state = EditorState.create({ doc: mergeStyle });
    let regions = findConflictsInDoc(state.doc);
    for (let round = 0; round < 2000; round++) {
      const length = state.doc.length;
      const from = random(length + 1);
      const to = Math.min(length, from + random(4));
      const insert = random(3) === 0 ? "" : pieces[random(pieces.length)];
      const tr = state.update({ changes: { from, to, insert } });
      regions = updateConflicts(regions, tr.changes, state.doc, tr.newDoc);
      state = tr.state;
      expect(regions).toEqual(findConflictsInDoc(state.doc));
    }
  });

  it("keeps the same array while typing away from markers", () => {
    const state = EditorState.create({ doc: "one\ntwo\nthree" });
    const none = findConflictsInDoc(state.doc);
    const tr = state.update({ changes: { from: 4, insert: "x" } });
    expect(updateConflicts(none, tr.changes, state.doc, tr.newDoc)).toBe(none);
  });

  it("moves regions when lines are added above them", () => {
    const state = EditorState.create({ doc: mergeStyle });
    const regions = findConflictsInDoc(state.doc);
    const tr = state.update({ changes: { from: 0, insert: "new\nlines\n" } });
    const moved = updateConflicts(regions, tr.changes, state.doc, tr.newDoc);
    expect(moved.map((region) => region.start)).toEqual(regions.map((region) => region.start + 2));
  });
});
