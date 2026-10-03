import { EditorState, type RangeSet } from "@codemirror/state";
import type { GutterMarker } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import type { ChangeMark } from "./lineDiff";
import { changeMarkField, fieldSource, gutterMarkerSource, setChangeMarks } from "./scrollMarkers";

function lines(state: EditorState, set: RangeSet<GutterMarker>): number[] {
  const found: number[] = [];
  set.between(0, state.doc.length, (from) => {
    found.push(state.doc.lineAt(from).number - 1);
  });
  return found;
}

describe("gutterMarkerSource", () => {
  const marks: ChangeMark[] = [
    { from: 1, to: 3, kind: "modified" },
    { from: 5, to: 5, kind: "deleted" },
  ];

  function setup() {
    const source = gutterMarkerSource(fieldSource);
    const doc = Array.from({ length: 8 }, (_, index) => `line ${index}`).join("\n");
    const state = EditorState.create({ doc, extensions: [changeMarkField, source.field] }).update({
      effects: setChangeMarks.of(marks),
    }).state;
    return { source, state };
  }

  it("builds markers for the marked lines", () => {
    const { source, state } = setup();
    expect(lines(state, source.markers(state))).toEqual([1, 2, 5]);
  });

  it("moves the markers with edits instead of rebuilding them", () => {
    const { source, state } = setup();
    const built = source.markers(state);
    const typed = state.update({ changes: { from: state.doc.line(2).from + 2, insert: "x" } }).state;
    const afterTyping = source.markers(typed);
    expect(lines(typed, afterTyping)).toEqual([1, 2, 5]);
    expect(afterTyping).not.toBe(built);
    // Two lines added at the top push every marker down.
    const added = typed.update({ changes: { from: 0, insert: "a\nb\n" } }).state;
    expect(lines(added, source.markers(added))).toEqual([3, 4, 7]);
  });

  it("rebuilds when new marks arrive", () => {
    const { source, state } = setup();
    source.markers(state);
    const next = state.update({ effects: setChangeMarks.of([{ from: 0, to: 1, kind: "added" }]) }).state;
    expect(lines(next, source.markers(next))).toEqual([0]);
  });
});
