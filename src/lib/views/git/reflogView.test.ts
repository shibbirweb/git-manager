import { describe, expect, it } from "vitest";
import type { ReflogEntry } from "$lib/types";
import { hasCommit, reflogActionLabel, visibleRange } from "./reflogView";

describe("reflogView", () => {
  it("labels each action", () => {
    expect(reflogActionLabel("cherryPick")).toBe("cherry-pick");
    expect(reflogActionLabel("initialCommit")).toBe("first commit");
    expect(reflogActionLabel("amend")).toBe("amend");
  });

  it("knows entries without a commit", () => {
    const entry = { newId: "0".repeat(40) } as ReflogEntry;
    expect(hasCommit(entry)).toBe(false);
    expect(hasCommit({ ...entry, newId: "ab".repeat(20) })).toBe(true);
  });

  it("renders only the rows on screen", () => {
    expect(visibleRange(0, 260, 26, 1000, 5)).toEqual({ start: 0, end: 16 });
    expect(visibleRange(2600, 260, 26, 1000, 5)).toEqual({ start: 95, end: 116 });
    expect(visibleRange(2600, 260, 26, 50, 5)).toEqual({ start: 50, end: 50 });
    expect(visibleRange(-10, 0, 26, 3, 5)).toEqual({ start: 0, end: 3 });
  });
});
