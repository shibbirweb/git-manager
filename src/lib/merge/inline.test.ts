import { describe, expect, it } from "vitest";
import { changedSpans } from "./inline";

function highlighted(before: string, after: string): string[] {
  return (changedSpans(before, after) ?? []).map((span) => after.slice(span.from, span.to));
}

describe("changedSpans", () => {
  it("highlights a changed word", () => {
    expect(highlighted("const total = price * qty;", "const total = price * quantity;")).toEqual(["quantity"]);
  });

  it("merges adjacent changed tokens", () => {
    expect(highlighted("call(a, b)", "call(a.b, b)")).toEqual([".b"]);
  });

  it("ignores whitespace-only differences", () => {
    expect(highlighted("a  b", "a b")).toEqual([]);
  });

  it("gives up on unrelated text", () => {
    expect(changedSpans("alpha beta gamma", "one two three four")).toBeNull();
  });

  it("works across lines", () => {
    expect(highlighted("line one\nline two", "line one\nline 2")).toEqual(["2"]);
  });
});
