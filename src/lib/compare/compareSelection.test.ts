import { describe, expect, it } from "vitest";
import { compareMenuPlan } from "./compareSelection";

const file = (path: string) => ({ path, isDir: false });

describe("compare menu plan", () => {
  it("offers Select for Compare on one file", () => {
    expect(compareMenuPlan([file("/w/a.ts")], null)).toEqual({ select: "/w/a.ts", withSelected: null, pair: null });
  });

  it("offers Compare with Selected on another file", () => {
    expect(compareMenuPlan([file("/w/b.ts")], "/w/a.ts").withSelected).toEqual(["/w/a.ts", "/w/b.ts"]);
    // The selected file itself has nothing to compare with.
    expect(compareMenuPlan([file("/w/a.ts")], "/w/a.ts").withSelected).toBeNull();
  });

  it("offers Compare Selected on two files", () => {
    expect(compareMenuPlan([file("/w/a.ts"), file("/w/b.ts")], "/w/c.ts")).toEqual({
      select: null,
      withSelected: null,
      pair: ["/w/a.ts", "/w/b.ts"],
    });
  });

  it("offers nothing for folders or more than two files", () => {
    expect(compareMenuPlan([{ path: "/w/src", isDir: true }], null)).toEqual({ select: null, withSelected: null, pair: null });
    expect(compareMenuPlan([file("/w/a"), { path: "/w/src", isDir: true }], null).pair).toBeNull();
    expect(compareMenuPlan([file("/w/a"), file("/w/b"), file("/w/c")], null).pair).toBeNull();
    expect(compareMenuPlan([], null).select).toBeNull();
  });
});
