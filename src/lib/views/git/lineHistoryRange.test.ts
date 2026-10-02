import { describe, expect, it } from "vitest";
import { headLineRange } from "./lineHistoryRange";

const head = ["a", "b", "c", "d", "e", ""];

describe("headLineRange", () => {
  it("keeps the lines when nothing changed", () => {
    expect(headLineRange(head, head, { start: 2, end: 4 })).toEqual({ start: 2, end: 4 });
  });

  it("shifts back past lines inserted above the selection", () => {
    const work = ["new 1", "new 2", "a", "b", "c", "d", "e", ""];
    expect(headLineRange(head, work, { start: 5, end: 6 })).toEqual({ start: 3, end: 4 });
  });

  it("shifts forward past lines deleted above the selection", () => {
    const work = ["c", "d", "e", ""];
    expect(headLineRange(head, work, { start: 2, end: 3 })).toEqual({ start: 4, end: 5 });
  });

  it("maps a modified line to its committed line", () => {
    const work = ["a", "B", "c", "d", "e", ""];
    expect(headLineRange(head, work, { start: 2, end: 2 })).toEqual({ start: 2, end: 2 });
  });

  it("is null when only new lines are selected", () => {
    const work = ["a", "new 1", "new 2", "b", "c", "d", "e", ""];
    expect(headLineRange(head, work, { start: 2, end: 3 })).toBeNull();
    expect(headLineRange([""], ["fresh", ""], { start: 1, end: 1 })).toBeNull();
  });

  it("drops new lines at the edges of a mixed selection", () => {
    const work = ["a", "new", "b", "c", "added", "d", "e", ""];
    expect(headLineRange(head, work, { start: 2, end: 5 })).toEqual({ start: 2, end: 3 });
  });

  it("covers committed lines deleted inside the selection", () => {
    const work = ["a", "e", ""];
    expect(headLineRange(head, work, { start: 1, end: 2 })).toEqual({ start: 1, end: 5 });
  });
});
