import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { InlineSpans } from "./inlineSpans";
import { statusText, unresolvedMessage } from "./mergeConfirm";
import { changedSpans } from "./inline";
import { initialChunks } from "./model";

describe("statusText", () => {
  it("says when every change is processed", () => {
    expect(statusText({ changes: 0, conflicts: 0 })).toBe("All changes processed");
  });

  it("counts open changes and conflicts", () => {
    expect(statusText({ changes: 1, conflicts: 0 })).toBe("1 change left");
    expect(statusText({ changes: 3, conflicts: 1 })).toBe("3 changes left, 1 conflict");
    expect(statusText({ changes: 4, conflicts: 2 })).toBe("4 changes left, 2 conflicts");
  });
});

describe("unresolvedMessage", () => {
  it("asks about open changes and names the conflicts among them", () => {
    expect(unresolvedMessage({ changes: 1, conflicts: 0 })).toBe(
      "1 change is still unresolved. Save the result as it is and mark the file resolved?",
    );
    expect(unresolvedMessage({ changes: 2, conflicts: 1 })).toBe(
      "2 changes are still unresolved, including 1 conflict. Save the result as it is and mark the file resolved?",
    );
  });
});

describe("InlineSpans", () => {
  const base = "a\nprice = 1\nc\n";
  const ours = "a\nprice = 2\nc\n";
  const theirs = "a\nprice = 3\nc\n";
  const [chunk] = initialChunks([
    {
      id: 7,
      kind: "conflict",
      base: { start: 1, end: 2 },
      ours: { start: 1, end: 2 },
      theirs: { start: 1, end: 2 },
    },
  ]);

  it("has nothing before the side texts are known", () => {
    expect(new InlineSpans(base).of(chunk, "ours")).toBeNull();
  });

  it("compares a side's lines with the base's", () => {
    const spans = new InlineSpans(base);
    spans.sides = { ours: Text.of(ours.split("\n")), theirs: Text.of(theirs.split("\n")) };
    expect(spans.of(chunk, "ours")).toEqual(changedSpans("price = 1\n", "price = 2\n"));
  });

  it("works each chunk out once", () => {
    const spans = new InlineSpans(base);
    spans.sides = { ours: Text.of(ours.split("\n")), theirs: Text.of(theirs.split("\n")) };
    expect(spans.of(chunk, "theirs")).toBe(spans.of(chunk, "theirs"));
  });
});
