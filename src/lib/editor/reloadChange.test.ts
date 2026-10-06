import { describe, expect, it } from "vitest";
import { reloadChange } from "./reloadChange";

function apply(previous: string, next: string): string {
  const change = reloadChange(previous, next);
  return change ? previous.slice(0, change.from) + change.insert + previous.slice(change.to) : previous;
}

describe("reloadChange", () => {
  it("is null for the same text", () => {
    expect(reloadChange("a\nb\n", "a\nb\n")).toBeNull();
  });

  it("inserts only the lines a log appended", () => {
    expect(reloadChange("one\ntwo\n", "one\ntwo\nthree\n")).toEqual({ from: 8, to: 8, insert: "three\n" });
  });

  it("replaces only the changed middle", () => {
    expect(reloadChange("a\nb\nc\n", "a\nX\nc\n")).toEqual({ from: 2, to: 3, insert: "X" });
  });

  it("handles a truncated or emptied file and repeated text", () => {
    for (const [previous, next] of [
      ["one\ntwo\n", ""],
      ["", "fresh\n"],
      ["aaaa", "aa"],
      ["aa", "aaaa"],
      ["abcabc", "abc"],
      ["log\nlog\n", "log\n"],
    ]) {
      expect(apply(previous, next)).toBe(next);
    }
  });
});
