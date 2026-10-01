import { describe, expect, it } from "vitest";
import type { ChangeMark } from "./lineDiff";
import { sectionAt, sectionTarget } from "./navigation";

const marks: ChangeMark[] = [
  { from: 2, to: 4, kind: "modified" },
  { from: 10, to: 10, kind: "deleted" },
  { from: 20, to: 25, kind: "conflict" },
];

describe("sectionAt", () => {
  it("finds the section containing a line", () => {
    expect(sectionAt(marks, 3)).toBe(0);
    expect(sectionAt(marks, 10)).toBe(1);
    expect(sectionAt(marks, 24)).toBe(2);
    expect(sectionAt(marks, 5)).toBe(-1);
  });
});

describe("sectionTarget", () => {
  it("moves forward and wraps to the first section", () => {
    expect(sectionTarget(marks, 0, 1)).toBe(marks[0]);
    expect(sectionTarget(marks, 3, 1)).toBe(marks[1]);
    expect(sectionTarget(marks, 22, 1)).toBe(marks[0]);
  });

  it("moves back from inside a section and wraps to the last one", () => {
    expect(sectionTarget(marks, 22, -1)).toBe(marks[1]);
    expect(sectionTarget(marks, 3, -1)).toBe(marks[2]);
  });

  it("moves back from between sections", () => {
    expect(sectionTarget(marks, 15, -1)).toBe(marks[1]);
    expect(sectionTarget(marks, 1, -1)).toBe(marks[2]);
  });

  it("returns null without sections", () => {
    expect(sectionTarget([], 5, 1)).toBeNull();
  });
});
