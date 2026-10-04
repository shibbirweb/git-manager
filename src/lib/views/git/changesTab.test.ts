import { describe, expect, it } from "vitest";
import type { FileStatus } from "$lib/types";
import {
  bulkTargets,
  changeAgainstHead,
  changesListBounds,
  changesTabFiles,
  fileActions,
  MIN_CHANGES_DIFF_WIDTH,
  pickSelected,
  stagedState,
  stepSelection,
} from "./changesTab";

function file(path: string, fields: Partial<FileStatus> = {}): FileStatus {
  return { path, origPath: null, staged: null, unstaged: null, conflicted: false, ...fields };
}

describe("changes tab", () => {
  it("gives one kind per file, compared with HEAD", () => {
    expect(changeAgainstHead(file("a", { unstaged: "modified" }))).toBe("modified");
    expect(changeAgainstHead(file("a", { staged: "modified", unstaged: "modified" }))).toBe("modified");
    expect(changeAgainstHead(file("a", { staged: "added", unstaged: "modified" }))).toBe("added");
    expect(changeAgainstHead(file("a", { unstaged: "untracked" }))).toBe("untracked");
    expect(changeAgainstHead(file("a", { staged: "modified", unstaged: "deleted" }))).toBe("deleted");
    expect(changeAgainstHead(file("a", { staged: "deleted" }))).toBe("deleted");
    expect(changeAgainstHead(file("b", { origPath: "a", staged: "renamed", unstaged: "modified" }))).toBe("renamed");
    expect(changeAgainstHead(file("a", { staged: "typechange" }))).toBe("typechange");
    expect(changeAgainstHead(file("a", { conflicted: true, staged: "modified" }))).toBeNull();
    expect(changeAgainstHead(file("a"))).toBe("modified");
  });

  it("lists conflicts first and keeps the old name only for renames", () => {
    const files = changesTabFiles([
      file("a.ts", { unstaged: "modified" }),
      file("b.ts", { conflicted: true }),
      file("c.ts", { origPath: "old.ts", staged: "renamed" }),
      file("d.ts", { origPath: "x.ts", unstaged: "modified" }),
      file("lib", { unstaged: "modified", submodule: { newCommits: true, modifiedContent: false, untrackedContent: false } }),
    ]);
    expect(files.map((entry) => entry.path)).toEqual(["b.ts", "a.ts", "c.ts", "d.ts", "lib"]);
    expect(files[2].origPath).toBe("old.ts");
    expect(files[3].origPath).toBeNull();
    expect(files[4].submodule).toBe(true);
    expect(changesTabFiles([])).toEqual([]);
  });

  it("keeps the selection while the file is still changed and steps through the list", () => {
    const files = changesTabFiles([file("a", { unstaged: "modified" }), file("b", { unstaged: "modified" })]);
    expect(pickSelected(files, "b")?.path).toBe("b");
    expect(pickSelected(files, "gone")?.path).toBe("a");
    expect(pickSelected([], "a")).toBeNull();
    expect(stepSelection(files, "a", 1)?.path).toBe("b");
    expect(stepSelection(files, "b", 1)?.path).toBe("b");
    expect(stepSelection(files, "a", -1)?.path).toBe("a");
    expect(stepSelection(files, null, 1)?.path).toBe("a");
    expect(stepSelection([], "a", 1)).toBeNull();
  });

  it("keeps the file list between its minimum and what the diff can spare", () => {
    expect(changesListBounds(320, 1000, 160)).toEqual({ width: 320, max: 1000 - MIN_CHANGES_DIFF_WIDTH });
    expect(changesListBounds(900, 1000, 160).width).toBe(1000 - MIN_CHANGES_DIFF_WIDTH);
    expect(changesListBounds(50, 1000, 160).width).toBe(160);
    expect(changesListBounds(320, 300, 160)).toEqual({ width: 160, max: 160 });
    expect(changesListBounds(320, 0, 160)).toEqual({ width: 320, max: 320 });
  });

  it("offers the sidebar's row actions for what each file has in each area", () => {
    const submodule = { newCommits: true, modifiedContent: false, untrackedContent: false };
    expect(fileActions(file("a", { unstaged: "modified" }))).toEqual(["discard", "stage"]);
    expect(fileActions(file("a", { unstaged: "untracked" }))).toEqual(["discard", "stage"]);
    expect(fileActions(file("a", { staged: "added" }))).toEqual(["unstage"]);
    expect(fileActions(file("a", { staged: "modified", unstaged: "modified" }))).toEqual(["unstage", "discard", "stage"]);
    expect(fileActions(file("a", { conflicted: true, staged: "modified", unstaged: "modified" }))).toEqual(["resolve"]);
    expect(fileActions(file("lib", { unstaged: "modified", submodule }))).toEqual(["stage"]);
    expect(fileActions(file("a"))).toEqual([]);
  });

  it("says how much of a file is staged", () => {
    expect(stagedState(file("a", { staged: "modified" }))).toBe("staged");
    expect(stagedState(file("a", { staged: "modified", unstaged: "modified" }))).toBe("partly staged");
    expect(stagedState(file("a", { unstaged: "modified" }))).toBeNull();
    expect(stagedState(file("a", { conflicted: true, staged: "modified" }))).toBeNull();
  });

  it("collects what Stage All, Unstage All and Discard All act on, leaving conflicts out", () => {
    const submodule = { newCommits: true, modifiedContent: false, untrackedContent: false };
    const targets = bulkTargets(
      changesTabFiles([
        file("a", { unstaged: "modified" }),
        file("b", { staged: "added" }),
        file("c", { staged: "modified", unstaged: "modified" }),
        file("d", { conflicted: true, unstaged: "modified" }),
        file("lib", { unstaged: "modified", submodule }),
      ]),
    );
    expect(targets.stage.map((entry) => entry.path)).toEqual(["a", "c", "lib"]);
    expect(targets.unstage.map((entry) => entry.path)).toEqual(["b", "c"]);
    expect(targets.discard.map((entry) => entry.path)).toEqual(["a", "c"]);
    expect(bulkTargets([])).toEqual({ stage: [], unstage: [], discard: [] });
  });
});
