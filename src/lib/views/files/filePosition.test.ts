import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { conflictField } from "$lib/editor/conflictDecorations";
import { changeMarkField, setChangeMarks } from "$lib/editor/scrollMarkers";
import { conflictAwareMarks } from "./fileGitInfo";
import { editorStatusOf, formatSize, sectionLabel } from "./filePosition";

describe("sectionLabel", () => {
  it("says there is nothing to go to", () => {
    expect(sectionLabel(0, -1, false)).toBe("No changes");
  });

  it("counts changes away from them and numbers the one at the caret", () => {
    expect(sectionLabel(1, -1, false)).toBe("1 change");
    expect(sectionLabel(5, -1, false)).toBe("5 changes");
    expect(sectionLabel(5, 1, false)).toBe("2 of 5");
  });

  it("calls them sections while the file has conflicts", () => {
    expect(sectionLabel(3, -1, true)).toBe("3 sections");
  });
});

describe("formatSize", () => {
  it("uses bytes, KB and MB", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
  });
});

describe("editorStatusOf", () => {
  it("reports the caret and the selected lines", () => {
    const state = EditorState.create({ doc: "one\ntwo\nthree", selection: { anchor: 1, head: 9 } });
    const status = editorStatusOf(state, "/w/notes.txt", "lf");
    expect(status).toMatchObject({ filePath: "/w/notes.txt", line: 3, column: 2, selected: 8, selectedLines: 3 });
    expect(status.eol).toBe("lf");
  });

  it("has no selected lines for a bare caret", () => {
    const state = EditorState.create({ doc: "one\ntwo", selection: { anchor: 5 } });
    expect(editorStatusOf(state, "/w/a.txt", "crlf")).toMatchObject({ line: 2, column: 2, selectedLines: 0 });
  });
});

describe("conflictAwareMarks", () => {
  const doc = ["a", "<<<<<<< ours", "b", "=======", "c", ">>>>>>> theirs", "d", "e"].join("\n");

  function stateWith(marks: { from: number; to: number; kind: "added" | "modified" }[]): EditorState {
    const state = EditorState.create({ doc, extensions: [conflictField, changeMarkField] });
    return state.update({ effects: setChangeMarks.of(marks) }).state;
  }

  it("drops changes inside a conflict and keeps the rest, in order", () => {
    const source = conflictAwareMarks();
    const marks = source(
      stateWith([
        { from: 7, to: 8, kind: "added" },
        { from: 2, to: 3, kind: "modified" },
      ]),
    );
    expect(marks).toEqual([
      { from: 1, to: 6, kind: "conflict" },
      { from: 7, to: 8, kind: "added" },
    ]);
  });

  it("returns the same list while the marks and conflicts are unchanged", () => {
    const source = conflictAwareMarks();
    const state = stateWith([{ from: 7, to: 8, kind: "added" }]);
    expect(source(state)).toBe(source(state));
  });
});
