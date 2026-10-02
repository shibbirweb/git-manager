import { EditorSelection, EditorState, type TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { duplicateSelection, joinLines, lineTargetPosition, parseLineTarget, sortLines, toggleCase } from "./textCommands";

/** A state from text where "|" marks carets and "[...]" selections (anchor at "[", head at "]"). */
function stateOf(marked: string, readOnly = false): EditorState {
  const ranges = [];
  let doc = "";
  let anchor: number | null = null;
  for (const char of marked) {
    if (char === "|") {
      ranges.push(EditorSelection.cursor(doc.length));
    } else if (char === "[") {
      anchor = doc.length;
    } else if (char === "]" && anchor !== null) {
      ranges.push(EditorSelection.range(anchor, doc.length));
      anchor = null;
    } else {
      doc += char;
    }
  }
  return EditorState.create({
    doc,
    selection: EditorSelection.create(ranges.length > 0 ? ranges : [EditorSelection.cursor(0)]),
    extensions: [EditorState.allowMultipleSelections.of(true), EditorState.readOnly.of(readOnly)],
  });
}

/** Applies a command result and marks the selection again, for readable expectations. */
function apply(state: EditorState, spec: TransactionSpec | null): string | null {
  if (!spec) {
    return null;
  }
  const next = state.update(spec).state;
  let text = next.doc.toString();
  const ranges = [...next.selection.ranges].sort((a, b) => b.from - a.from);
  for (const range of ranges) {
    if (range.empty) {
      text = `${text.slice(0, range.head)}|${text.slice(range.head)}`;
    } else {
      text = `${text.slice(0, range.from)}[${text.slice(range.from, range.to)}]${text.slice(range.to)}`;
    }
  }
  return text;
}

describe("duplicateSelection", () => {
  it("copies the line below and keeps the caret column", () => {
    const state = stateOf("one\ntw|o\nthree");
    expect(apply(state, duplicateSelection(state))).toBe("one\ntwo\ntw|o\nthree");
  });

  it("copies a selection right after itself and selects the copy", () => {
    const state = stateOf("a [bc] d");
    expect(apply(state, duplicateSelection(state))).toBe("a bc[bc] d");
  });

  it("handles several carets", () => {
    const state = stateOf("a|\nb|");
    expect(apply(state, duplicateSelection(state))).toBe("a\na|\nb\nb|");
  });

  it("does nothing in a read-only editor", () => {
    expect(duplicateSelection(stateOf("a|", true))).toBeNull();
  });
});

describe("joinLines", () => {
  it("joins the caret line with the next, trimming the indentation", () => {
    const state = stateOf("if (a) {|  \n    run();\n}");
    expect(apply(state, joinLines(state))).toBe("if (a) {| run();\n}");
  });

  it("joins every line of a selection", () => {
    const state = stateOf("[a\n  b\n  c]\nd");
    expect(apply(state, joinLines(state))).toBe("[a b c]\nd");
  });

  it("removes a blank next line without adding a space", () => {
    const state = stateOf("a|\n\nb");
    expect(apply(state, joinLines(state))).toBe("a|\nb");
  });

  it("has nothing to join on the last line", () => {
    expect(joinLines(stateOf("a\nb|"))).toBeNull();
  });
});

describe("toggleCase", () => {
  it("upper-cases text with a lower case letter, lower-cases the rest", () => {
    const lower = stateOf("x [Hello] y");
    expect(apply(lower, toggleCase(lower))).toBe("x [HELLO] y");
    const upper = stateOf("x [HELLO] y");
    expect(apply(upper, toggleCase(upper))).toBe("x [hello] y");
  });

  it("works on the word at the caret", () => {
    const state = stateOf("let va|lue = 1");
    expect(apply(state, toggleCase(state))).toBe("let VA|LUE = 1");
  });

  it("covers text whose length changes", () => {
    const state = stateOf("[straße]");
    expect(apply(state, toggleCase(state))).toBe("[STRASSE]");
  });

  it("does nothing without letters", () => {
    expect(toggleCase(stateOf("[123]"))).toBeNull();
  });
});

describe("sortLines", () => {
  it("sorts the selected lines", () => {
    const state = stateOf("z\n[c\na\nb]\ny");
    expect(apply(state, sortLines(state))).toBe("z\n[a\nb\nc]\ny");
  });

  it("leaves out a last line the selection only touches at its start", () => {
    const state = stateOf("[b\na\n]c");
    expect(apply(state, sortLines(state))).toBe("[a\nb]\nc");
  });

  it("sorts the whole document without a selection, by character code", () => {
    const state = stateOf("b\nB\na|");
    expect(apply(state, sortLines(state))).toBe("[B\na\nb]");
  });

  it("does nothing when the lines are already in order", () => {
    expect(sortLines(stateOf("[a\nb]"))).toBeNull();
  });
});

describe("parseLineTarget", () => {
  it("reads a line and an optional column", () => {
    expect(parseLineTarget("12", 100)).toEqual({ line: 12, column: 1 });
    expect(parseLineTarget(" 12:7 ", 100)).toEqual({ line: 12, column: 7 });
    expect(parseLineTarget("12,7", 100)).toEqual({ line: 12, column: 7 });
  });

  it("clamps to the document", () => {
    expect(parseLineTarget("500", 40)).toEqual({ line: 40, column: 1 });
    expect(parseLineTarget("0:0", 40)).toEqual({ line: 1, column: 1 });
  });

  it("rejects anything else", () => {
    expect(parseLineTarget("", 10)).toBeNull();
    expect(parseLineTarget("abc", 10)).toBeNull();
    expect(parseLineTarget("3:", 10)).toBeNull();
    expect(parseLineTarget("-2", 10)).toBeNull();
  });

  it("stops the column at the end of the line", () => {
    const state = stateOf("ab\ncdef");
    expect(lineTargetPosition(state, { line: 2, column: 3 })).toBe(5);
    expect(lineTargetPosition(state, { line: 1, column: 99 })).toBe(2);
  });
});
