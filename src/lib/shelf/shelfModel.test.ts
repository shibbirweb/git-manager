import { describe, expect, it } from "vitest";
import type { FileStatus, ShelfEntry, ShelvedFile } from "$lib/types";
import {
  changeLetter,
  clickSelection,
  defaultShelfName,
  fileCountLabel,
  formatShelfDate,
  shelveCandidates,
  shelvedFileLabel,
  statusLetter,
  validSelection,
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
    expect(changeLetter("added")).toBe("A");
    expect(changeLetter("renamed")).toBe("R");
    expect(fileCountLabel(1)).toBe("1 file");
    expect(fileCountLabel(3)).toBe("3 files");
    expect(statusLetter(status("n", { unstaged: "untracked" }))).toBe("U");
    expect(statusLetter(status("s", { staged: "added", unstaged: "modified" }))).toBe("A");
    expect(statusLetter(status("d", { unstaged: "deleted" }))).toBe("D");
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

describe("shelf selection", () => {
  const first = { shelfId: "1-0", filePath: "a.txt" };
  const second = { shelfId: "1-0", filePath: "b.txt" };
  const other = { shelfId: "2-0", filePath: "c.txt" };

  it("selects one file, or toggles files of the same list", () => {
    expect(clickSelection([first], second, false)).toEqual([second]);
    expect(clickSelection([first], second, true)).toEqual([first, second]);
    expect(clickSelection([first, second], first, true)).toEqual([second]);
    expect(clickSelection([first, second], other, true)).toEqual([other]);
  });

  it("drops files that left the shelf", () => {
    const entries: ShelfEntry[] = [
      { version: 1, id: "1-0", name: "n", createdAt: 0, branch: null, headCommit: null, files: [shelved("a.txt")] },
    ];
    expect(validSelection([first, second, other], entries)).toEqual([first]);
  });
});
