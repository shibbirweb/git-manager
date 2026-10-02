import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { selectionInfo } from "./selectionInfo";

describe("selectionInfo", () => {
  it("gives 1-based lines and columns and the selected text", () => {
    const state = EditorState.create({
      doc: "first\nsecond line\nthird",
      selection: EditorSelection.create([EditorSelection.range(8, 13), EditorSelection.cursor(0)], 0),
      extensions: EditorState.allowMultipleSelections.of(true),
    });
    const info = selectionInfo(state);
    expect(info.lineCount).toBe(3);
    // CodeMirror keeps ranges in document order; the main one moves with them.
    expect(info.main).toBe(1);
    expect(info.ranges[1]).toMatchObject({ anchor: { line: 2, column: 3 }, head: { line: 2, column: 8 }, from: 8, to: 13, text: "cond " });
    expect(info.ranges).toHaveLength(2);
  });
});
