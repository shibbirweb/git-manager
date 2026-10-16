import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { diffLines } from "./lineDiff";
import { changeAtLine, revertEdit } from "./revertLines";

const lines = (text: string) => text.split("\n");

/** Reverts the change on `line` of `now` against `head`. */
function revertAt(head: string, now: string, line: number): string {
  const doc = Text.of(lines(now));
  const hunk = changeAtLine(diffLines(lines(head), lines(now)), line, doc.lines);
  if (!hunk) {
    throw new Error(`no change on line ${line}`);
  }
  const edit = revertEdit(doc, hunk, lines(head));
  return doc.replace(edit.from, edit.to, Text.of(lines(edit.insert))).toString();
}

describe("changeAtLine", () => {
  const hunks = diffLines(lines("a\nb\nc\nd"), lines("a\nB\nc"));

  it("finds the change a line is in", () => {
    expect(changeAtLine(hunks, 1, 3)).toEqual({ oldStart: 1, oldEnd: 2, newStart: 1, newEnd: 2 });
  });

  it("finds a deletion at the end on the last line", () => {
    expect(changeAtLine(hunks, 2, 3)).toEqual({ oldStart: 3, oldEnd: 4, newStart: 3, newEnd: 3 });
  });

  it("is null on an unchanged line", () => {
    expect(changeAtLine(hunks, 0, 3)).toBeNull();
  });
});

describe("revertEdit", () => {
  it("puts modified lines back", () => {
    expect(revertAt("a\nb\nc\n", "a\nB\nB2\nc\n", 2)).toBe("a\nb\nc\n");
  });

  it("removes added lines in the middle, at the start and at the end", () => {
    expect(revertAt("a\nc\n", "a\nb\nc\n", 1)).toBe("a\nc\n");
    expect(revertAt("b\n", "a\nb\n", 0)).toBe("b\n");
    expect(revertAt("a", "a\nb", 1)).toBe("a");
    expect(revertAt("", "new", 0)).toBe("");
  });

  it("brings deleted lines back, in the middle and at the end", () => {
    expect(revertAt("a\nb\nc\n", "a\nc\n", 1)).toBe("a\nb\nc\n");
    expect(revertAt("a\nb\nc", "a", 0)).toBe("a\nb\nc");
  });

  it("reverts only the clicked change", () => {
    expect(revertAt("a\nb\nc\nd\n", "A\nb\nc\nD\n", 3)).toBe("A\nb\nc\nd\n");
  });
});
