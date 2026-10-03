import { history, undo } from "@codemirror/commands";
import { EditorSelection, EditorState, Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { caretLines, type SaveCleanupOptions, saveCleanupChanges, saveCleanupTransaction } from "./saveCleanup";

const off: SaveCleanupOptions = { trimTrailingWhitespace: false, insertFinalNewline: false, trimFinalNewlines: false, markdown: false };

/** The text after the clean-up. */
function clean(text: string, options: Partial<SaveCleanupOptions>): string {
  const doc = Text.of(text.split("\n"));
  const changes = saveCleanupChanges(doc, { ...off, ...options });
  const state = EditorState.create({ doc });
  return state.update({ changes }).state.doc.toString();
}

describe("saveCleanupChanges", () => {
  it("changes nothing with every option off", () => {
    expect(saveCleanupChanges(Text.of(["a  ", "", ""]), off)).toEqual([]);
  });

  it("trims trailing spaces and tabs", () => {
    expect(clean("a  \nb\t\n  \nc", { trimTrailingWhitespace: true })).toBe("a\nb\n\nc");
    expect(clean("clean\n", { trimTrailingWhitespace: true })).toBe("clean\n");
  });

  it("keeps Markdown hard line breaks", () => {
    const text = "line one  \nline two   \ntabbed \t\nsingle \n   \nend";
    expect(clean(text, { trimTrailingWhitespace: true, markdown: true })).toBe("line one  \nline two   \ntabbed\nsingle\n\nend");
    expect(clean(text, { trimTrailingWhitespace: true })).toBe("line one\nline two\ntabbed\nsingle\n\nend");
  });

  it("inserts a final newline only when missing", () => {
    expect(clean("a", { insertFinalNewline: true })).toBe("a\n");
    expect(clean("a\n", { insertFinalNewline: true })).toBe("a\n");
    expect(clean("", { insertFinalNewline: true })).toBe("");
    expect(clean("a\n  ", { insertFinalNewline: true })).toBe("a\n  \n");
  });

  it("does not add a newline after a last line that trimming empties", () => {
    expect(clean("a\n  ", { trimTrailingWhitespace: true, insertFinalNewline: true })).toBe("a\n");
    expect(clean("a  ", { trimTrailingWhitespace: true, insertFinalNewline: true })).toBe("a\n");
    expect(clean("   ", { trimTrailingWhitespace: true, insertFinalNewline: true })).toBe("");
  });

  it("trims final newlines down to one", () => {
    expect(clean("a\n\n\n", { trimFinalNewlines: true })).toBe("a\n");
    expect(clean("a\n \n\t\n", { trimFinalNewlines: true })).toBe("a\n");
    expect(clean("a", { trimFinalNewlines: true })).toBe("a");
    expect(clean("a\n", { trimFinalNewlines: true })).toBe("a\n");
    expect(clean("\n\n", { trimFinalNewlines: true })).toBe("");
  });

  it("combines all three", () => {
    const options = { trimTrailingWhitespace: true, insertFinalNewline: true, trimFinalNewlines: true };
    expect(clean("a  \nb \n\n\n", options)).toBe("a\nb\n");
    expect(clean("a  ", options)).toBe("a\n");
  });

  it("leaves lines with a caret alone for an auto save", () => {
    const keepLines = new Set([1, 4]);
    expect(clean("typing \nother  \n\n\n", { trimTrailingWhitespace: true, trimFinalNewlines: true, keepLines })).toBe(
      "typing \nother\n\n\n",
    );
    expect(clean("a\n\n\n\n\n", { trimFinalNewlines: true, keepLines: new Set([3]) })).toBe("a\n\n\n");
  });
});

describe("saveCleanupTransaction", () => {
  function stateWith(text: string, caret: number): EditorState {
    return EditorState.create({ doc: text, selection: EditorSelection.cursor(caret), extensions: [history()] });
  }

  it("is null when the text is already clean", () => {
    expect(saveCleanupTransaction(stateWith("a\n", 0), { ...off, trimTrailingWhitespace: true, insertFinalNewline: true })).toBeNull();
  });

  it("keeps the caret on its text and undoes in one step", () => {
    const before = stateWith("one  \ntwo\t\nthree", 7);
    const spec = saveCleanupTransaction(before, { ...off, trimTrailingWhitespace: true, insertFinalNewline: true });
    expect(spec).not.toBeNull();
    let state = before.update(spec ?? {}).state;
    expect(state.doc.toString()).toBe("one\ntwo\nthree\n");
    // The caret was after "t" of "two"; it still is.
    expect(state.selection.main.head).toBe(5);
    undo({
      state,
      dispatch: (transaction) => {
        state = transaction.state;
      },
    });
    expect(state.doc.toString()).toBe("one  \ntwo\t\nthree");
  });

  it("keeps a caret at the end before the added newline", () => {
    const before = stateWith("abc", 3);
    const state = before.update(saveCleanupTransaction(before, { ...off, insertFinalNewline: true }) ?? {}).state;
    expect(state.doc.toString()).toBe("abc\n");
    expect(state.selection.main.head).toBe(3);
  });

  it("lists the caret lines", () => {
    const state = EditorState.create({
      doc: "a\nb\nc",
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.range(2, 4)]),
      extensions: [EditorState.allowMultipleSelections.of(true)],
    });
    expect([...caretLines(state)]).toEqual([1, 3]);
  });
});
