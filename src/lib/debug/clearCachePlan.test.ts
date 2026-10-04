import { describe, expect, it } from "vitest";
import { clearCachePlan, type ClearCacheState } from "./clearCachePlan";

const idle: ClearCacheState = { dirtyFiles: 0, terminals: 0, busy: null, mergeOpen: false };

describe("clearCachePlan", () => {
  it("restarts at once when nothing can be lost", () => {
    expect(clearCachePlan(idle)).toEqual({ kind: "go" });
  });

  it("asks first when terminals would close", () => {
    const one = clearCachePlan({ ...idle, terminals: 1 });
    expect(one.kind).toBe("confirm");
    expect(one.kind === "confirm" && one.message).toContain("The open terminal closes and its shell stops");
    const two = clearCachePlan({ ...idle, terminals: 2 });
    expect(two.kind === "confirm" && two.message).toContain("2 terminals close and their shells stop");
  });

  it("waits for unsaved files, a running git operation and the merge tool", () => {
    expect(clearCachePlan({ ...idle, dirtyFiles: 1, terminals: 3 })).toEqual({
      kind: "blocked",
      message: "Save or close the 1 file with unsaved changes first.",
    });
    expect(clearCachePlan({ ...idle, dirtyFiles: 2 })).toEqual({ kind: "blocked", message: "Save or close the 2 files with unsaved changes first." });
    expect(clearCachePlan({ ...idle, busy: "Fetch" })).toEqual({ kind: "blocked", message: 'Wait until "Fetch" finishes.' });
    expect(clearCachePlan({ ...idle, mergeOpen: true })).toEqual({ kind: "blocked", message: "Finish or close the merge tool first." });
  });

  it("never uses an em-dash", () => {
    const message = clearCachePlan({ ...idle, terminals: 2 });
    expect(message.kind === "confirm" && message.message).not.toContain("\u2014");
  });
});
