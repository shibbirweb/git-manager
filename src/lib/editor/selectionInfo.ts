// An editor's selection as plain data with 1-based lines and columns (the MCP
// get_editor_selection tool reads it through fileCommands).

import type { EditorState } from "@codemirror/state";
import type { EditorSelectionInfo } from "$lib/stores/fileCommands.svelte";

/** Selected text longer than this is cut, so a select-all on a huge file stays small. */
export const MAX_SELECTION_TEXT = 20_000;

function position(state: EditorState, offset: number): { line: number; column: number } {
  const line = state.doc.lineAt(offset);
  return { line: line.number, column: offset - line.from + 1 };
}

export function selectionInfo(state: EditorState): EditorSelectionInfo {
  const selection = state.selection;
  return {
    main: selection.mainIndex,
    lineCount: state.doc.lines,
    ranges: selection.ranges.map((range) => ({
      anchor: position(state, range.anchor),
      head: position(state, range.head),
      from: range.from,
      to: range.to,
      text: state.sliceDoc(range.from, Math.min(range.to, range.from + MAX_SELECTION_TEXT)),
    })),
  };
}
