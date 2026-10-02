import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { activeLineStarts } from "./activeLine";

const doc = "first line\nsecond line\nthird line";

function state(selection: EditorSelection): EditorState {
  return EditorState.create({ doc, selection, extensions: EditorState.allowMultipleSelections.of(true) });
}

describe("activeLineStarts", () => {
  it("highlights the cursor's line while nothing is selected", () => {
    expect(activeLineStarts(state(EditorSelection.single(14)))).toEqual([11]);
    expect(activeLineStarts(state(EditorSelection.create([EditorSelection.cursor(2), EditorSelection.cursor(25)])))).toEqual([0, 23]);
  });

  it("highlights nothing while text is selected, so the selection shows", () => {
    expect(activeLineStarts(state(EditorSelection.single(12, 17)))).toEqual([]);
    expect(activeLineStarts(state(EditorSelection.create([EditorSelection.cursor(2), EditorSelection.range(12, 17)])))).toEqual([]);
  });
});
