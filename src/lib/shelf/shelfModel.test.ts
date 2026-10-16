import { describe, expect, it } from "vitest";
import type { FileStatus, ShelfEntry, ShelvedFile } from "$lib/types";
import {
  defaultShelfName,
  entryRowId,
  fileCountLabel,
  fileRowId,
  formatShelfDate,
  selectedPaths,
  shelfRows,
  shelveCandidates,
  shelvedFileLabel,
} from "./shelfModel";

function status(path: string, patch: Partial<FileStatus> = {}): FileStatus {
  return { path, origPath: null, staged: null, unstaged: "modified", conflicted: false, ...patch };
}

function shelved(path: string, patch: Partial<ShelvedFile> = {}): ShelvedFile {
  return { path, oldPath: null, change: "modified", binary: false, oldId: null, ...patch };
}

describe("shelf names and labels", () => {
  it("names shelved changes after the branch and the time", () => {
    const now = new Date(2026, 9, 1, 14, 3);
    expect(defaultShelfName("main", now)).toBe("Changes from main 2026-10-01 14:03");
    expect(defaultShelfName(null, now)).toBe("Changes from 2026-10-01 14:03");
    expect(formatShelfDate(new Date(2026, 0, 5, 9, 7).getTime())).toBe("2026-01-05 09:07");
  });

  it("labels files and counts", () => {
    expect(shelvedFileLabel(shelved("new.txt", { oldPath: "old.txt", change: "renamed" }))).toBe("old.txt -> new.txt");
    expect(shelvedFileLabel(shelved("a.txt"))).toBe("a.txt");
    expect(fileCountLabel(1)).toBe("1 file");
    expect(fileCountLabel(3)).toBe("3 files");
  });

  it("leaves conflicts, nested repositories and submodules out of Shelve Changes", () => {
    const files = [
      status("ok.txt"),
      status("both.txt", { conflicted: true }),
      status("nested/", { unstaged: "untracked" }),
      status("lib", { submodule: {} as NonNullable<FileStatus["submodule"]> }),
    ];
    expect(shelveCandidates(files).map((file) => file.path)).toEqual(["ok.txt"]);
  });
});

describe("shelf rows and selection", () => {
  const entry = (id: string, paths: string[]): ShelfEntry => ({
    version: 1,
    id,
    name: id,
    createdAt: 0,
    branch: null,
    headCommit: null,
    files: paths.map((path) => shelved(path)),
  });
  const entries = [entry("1-0", ["a.txt", "b.txt"]), entry("2-0", ["c.txt"])];

  it("lists each change list with its files unless folded", () => {
    expect(shelfRows(entries, new Set()).map((row) => row.id)).toEqual([
      entryRowId("1-0"),
      fileRowId("1-0", "a.txt"),
      fileRowId("1-0", "b.txt"),
      entryRowId("2-0"),
      fileRowId("2-0", "c.txt"),
    ]);
    expect(shelfRows(entries, new Set(["1-0"])).map((row) => row.id)).toEqual([
      entryRowId("1-0"),
      entryRowId("2-0"),
      fileRowId("2-0", "c.txt"),
    ]);
  });

  it("takes the selected files of one list only", () => {
    const selection = [fileRowId("1-0", "b.txt"), fileRowId("2-0", "c.txt"), entryRowId("1-0")];
    expect(selectedPaths(selection, entries[0])).toEqual(["b.txt"]);
    expect(selectedPaths([fileRowId("1-0", "gone.txt")], entries[0])).toEqual([]);
  });
});
