import { describe, expect, it } from "vitest";
import { isMissingFileError, MAX_ENTRIES, NavigationHistory } from "./navHistory";

describe("NavigationHistory", () => {
  it("never records a terminal or commit tab as a stop", () => {
    const history = new NavigationHistory();
    expect(history.record({ filePath: "/work/a.ts", line: 0 })).toBe(true);
    expect(history.record({ filePath: "terminal:3", line: 0 })).toBe(false);
    expect(history.record({ filePath: "commit:a9f492bf@/work", line: 0 })).toBe(false);
    expect(history.current).toEqual({ filePath: "/work/a.ts", line: 0 });
    expect(history.back).toEqual([]);
  });

  it("keeps small moves in one entry and records jumps", () => {
    const history = new NavigationHistory();
    expect(history.record({ filePath: "a.ts", line: 0 })).toBe(true);
    expect(history.record({ filePath: "a.ts", line: 5 })).toBe(false);
    expect(history.record({ filePath: "a.ts", line: 200 })).toBe(true);
    expect(history.back).toEqual([{ filePath: "a.ts", line: 5 }]);
  });

  it("treats another file as a new entry", () => {
    const history = new NavigationHistory();
    history.record({ filePath: "a.ts", line: 3 });
    expect(history.record({ filePath: "b.ts", line: 3 })).toBe(true);
    expect(history.back).toEqual([{ filePath: "a.ts", line: 3 }]);
  });

  it("goes back and forward across files", () => {
    const history = new NavigationHistory();
    history.record({ filePath: "a.ts", line: 0 });
    history.record({ filePath: "a.ts", line: 200 });
    history.record({ filePath: "b.ts", line: 0 });

    expect(history.goBack()).toEqual({ filePath: "a.ts", line: 200 });
    expect(history.goBack()).toEqual({ filePath: "a.ts", line: 0 });
    expect(history.goBack()).toBeNull();
    expect(history.goForward()).toEqual({ filePath: "a.ts", line: 200 });
    expect(history.goForward()).toEqual({ filePath: "b.ts", line: 0 });
    expect(history.goForward()).toBeNull();
  });

  it("drops the forward list after a new jump", () => {
    const history = new NavigationHistory();
    history.record({ filePath: "a.ts", line: 0 });
    history.record({ filePath: "b.ts", line: 0 });
    history.goBack();
    history.record({ filePath: "c.ts", line: 0 });
    expect(history.forward).toEqual([]);
    expect(history.goBack()).toEqual({ filePath: "a.ts", line: 0 });
  });

  it("caps the history and forgets deleted files", () => {
    const history = new NavigationHistory();
    for (let index = 0; index <= MAX_ENTRIES + 5; index++) {
      history.record({ filePath: `f${index}.ts`, line: 0 });
    }
    expect(history.back).toHaveLength(MAX_ENTRIES);
    history.forget("f10.ts");
    expect(history.back.some((location) => location.kind !== "diff" && location.filePath === "f10.ts")).toBe(false);
  });

  it("records a jump to the Log and comes back to the exact file line", () => {
    const history = new NavigationHistory();
    history.record({ filePath: "a.ts", line: 120 });
    history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts" });
    expect(history.goBack()).toEqual({ filePath: "a.ts", line: 120 });
    expect(history.goForward()).toEqual({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts" });
  });

  it("treats two Log entries for the same commit as one", () => {
    const history = new NavigationHistory();
    history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: null });
    expect(history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "x.ts" })).toBe(false);
    expect(history.record({ kind: "log", repoRoot: "/repo", commitId: "def", filePath: null })).toBe(true);
  });

  it("keeps Log entries when forgetting a file", () => {
    const history = new NavigationHistory();
    history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts" });
    history.record({ filePath: "a.ts", line: 0 });
    history.record({ filePath: "b.ts", line: 0 });
    history.forget("a.ts");
    expect(history.back).toEqual([{ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts" }]);
  });

  it("records Changes diffs and nearby lines in them as one step", () => {
    const history = new NavigationHistory();
    const diff = { kind: "diff" as const, repoRoot: "/repo", path: "a.ts", area: "unstaged" as const, line: 0 };
    history.record(diff);
    expect(history.record({ ...diff, line: 4 })).toBe(false);
    expect(history.record({ ...diff, area: "staged" as const })).toBe(true);
    history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts", line: 30 });
    expect(history.goBack()).toEqual({ ...diff, area: "staged" as const });
    expect(history.goBack()).toEqual({ ...diff, line: 4 });
  });

  it("records another file of the same commit as a new Log step", () => {
    const history = new NavigationHistory();
    history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts", line: 3 });
    expect(history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "b.ts" })).toBe(true);
    expect(history.back).toEqual([{ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts", line: 3 }]);
  });

  it("keeps the file of a Log step when a later click on the same commit has none", () => {
    const history = new NavigationHistory();
    const step = { kind: "log" as const, repoRoot: "/repo", commitId: "abc", filePath: "a.ts", line: 3 };
    history.record(step);
    expect(history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: null })).toBe(false);
    expect(history.current).toEqual(step);
    history.record({ filePath: "b.ts", line: 0 });
    expect(history.goBack()).toEqual(step);
  });

  it("lets a later step name the file of a Log step without one", () => {
    const history = new NavigationHistory();
    history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: null });
    history.record({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts", line: 8 });
    expect(history.current).toEqual({ kind: "log", repoRoot: "/repo", commitId: "abc", filePath: "a.ts", line: 8 });
  });
});

describe("NavigationHistory.recentFilePaths", () => {
  it("lists visited files most recent first, once each, without Log or diff stops", () => {
    const history = new NavigationHistory();
    history.record({ filePath: "/w/a.ts", line: 0 });
    history.record({ filePath: "/w/b.ts", line: 0 });
    history.record({ kind: "diff", repoRoot: "/w", path: "c.ts", area: "unstaged", line: 0 });
    history.record({ filePath: "/w/a.ts", line: 100 });
    history.record({ filePath: "/w/d.ts", line: 0 });
    expect(history.recentFilePaths()).toEqual(["/w/d.ts", "/w/a.ts", "/w/b.ts"]);
    history.goBack();
    // Forward stops were visited after the back ones.
    expect(history.recentFilePaths()).toEqual(["/w/a.ts", "/w/d.ts", "/w/b.ts"]);
    expect(new NavigationHistory().recentFilePaths()).toEqual([]);
  });
});

describe("NavigationHistory.travel", () => {
  const shown = async () => "shown" as const;

  function filled(): NavigationHistory {
    const history = new NavigationHistory();
    history.record({ filePath: "a.ts", line: 0 });
    history.record({ filePath: "gone.ts", line: 0 });
    history.record({ filePath: "b.ts", line: 0 });
    history.record({ filePath: "gone.ts", line: 300 });
    history.record({ filePath: "c.ts", line: 0 });
    return history;
  }

  it("steps like goBack and goForward when the stop is shown", async () => {
    const history = filled();
    expect(await history.travel("back", shown)).toEqual({ filePath: "gone.ts", line: 300 });
    expect(await history.travel("forward", shown)).toEqual({ filePath: "c.ts", line: 0 });
    expect(await history.travel("forward", shown)).toBeNull();
  });

  it("skips a stop that is gone and forgets the rest of that file", async () => {
    const history = filled();
    const tried: string[] = [];
    const target = await history.travel("back", async (location) => {
      tried.push(location.kind === undefined || location.kind === "file" ? location.filePath : location.kind);
      return location.kind !== "log" && location.kind !== "diff" && location.filePath === "gone.ts" ? "gone" : "shown";
    });
    expect(tried).toEqual(["gone.ts", "b.ts"]);
    expect(target).toEqual({ filePath: "b.ts", line: 0 });
    expect(history.back).toEqual([{ filePath: "a.ts", line: 0 }]);
    expect(history.forward).toEqual([{ filePath: "c.ts", line: 0 }]);
  });

  it("drops a Changes stop that is gone but keeps other stops of that file", async () => {
    const history = new NavigationHistory();
    const diff = { kind: "diff" as const, repoRoot: "/repo", path: "a.ts", area: "unstaged" as const, line: 0 };
    history.record({ filePath: "/repo/a.ts", line: 0 });
    history.record(diff);
    history.record({ filePath: "/repo/b.ts", line: 0 });
    const target = await history.travel("back", async (location) => (location.kind === "diff" ? "gone" : "shown"));
    expect(target).toEqual({ filePath: "/repo/a.ts", line: 0 });
    expect(history.forward).toEqual([{ filePath: "/repo/b.ts", line: 0 }]);
    expect(history.goForward()).toEqual({ filePath: "/repo/b.ts", line: 0 });
    expect(history.back).toEqual([{ filePath: "/repo/a.ts", line: 0 }]);
  });

  it("leaves the history as it was when a step is cancelled", async () => {
    const history = filled();
    const back = history.back.slice();
    expect(await history.travel("back", async () => "cancelled")).toBeNull();
    expect(history.back).toEqual(back);
    expect(history.current).toEqual({ filePath: "c.ts", line: 0 });
    expect(history.forward).toEqual([]);
  });

  it("returns null when every stop left is gone", async () => {
    const history = filled();
    expect(await history.travel("back", async () => "gone")).toBeNull();
    expect(history.back).toEqual([]);
    expect(history.current).toEqual({ filePath: "c.ts", line: 0 });
  });
});

describe("isMissingFileError", () => {
  it("recognizes a missing file on macOS, Linux and Windows", () => {
    expect(isMissingFileError({ kind: "io", message: "No such file or directory (os error 2)" })).toBe(true);
    expect(isMissingFileError("The system cannot find the file specified. (os error 2)")).toBe(true);
  });

  it("ignores other errors and odd values", () => {
    expect(isMissingFileError({ kind: "io", message: "Permission denied (os error 13)" })).toBe(false);
    expect(isMissingFileError({ kind: "io", message: "Bad (os error 22)" })).toBe(false);
    expect(isMissingFileError(null)).toBe(false);
    expect(isMissingFileError({})).toBe(false);
  });
});
