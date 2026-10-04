import { describe, expect, it } from "vitest";
import { clearCachePlan, type ClearCacheState } from "./clearCachePlan";

const idle: ClearCacheState = { dirtyFiles: 0, busy: null, mergeOpen: false };

describe("clearCachePlan", () => {
  it("restarts at once when nothing can be lost", () => {
    expect(clearCachePlan(idle)).toEqual({ kind: "go" });
  });

  it("waits for unsaved files, a running git operation and the merge tool", () => {
    expect(clearCachePlan({ ...idle, dirtyFiles: 1 })).toEqual({ kind: "blocked", message: "Save or close the 1 file with unsaved changes first." });
    expect(clearCachePlan({ ...idle, dirtyFiles: 2 })).toEqual({ kind: "blocked", message: "Save or close the 2 files with unsaved changes first." });
    expect(clearCachePlan({ ...idle, busy: "Fetch" })).toEqual({ kind: "blocked", message: 'Wait until "Fetch" finishes.' });
    expect(clearCachePlan({ ...idle, mergeOpen: true })).toEqual({ kind: "blocked", message: "Finish or close the merge tool first." });
  });
});
