import { describe, expect, it } from "vitest";
import type { ChangedFile, CommitDetails } from "$lib/types";
import {
  commitFileRows,
  fileRowAt,
  fileRowKey,
  filesCaption,
  parentFiles,
  parentLabel,
  pickFileRow,
} from "./commitFiles";

function file(filePath: string, origPath: string | null = null): ChangedFile {
  return { path: filePath, origPath, status: origPath ? "renamed" : "modified" };
}

function commit(parents: string[], files: ChangedFile[], later: ChangedFile[][] = [], merged: ChangedFile[] = []) {
  const details: CommitDetails = {
    id: "c".repeat(40),
    message: "message",
    authorName: "Ann",
    authorEmail: "ann@example.com",
    authorTime: 0,
    committerName: "Ann",
    committerTime: 0,
    parents,
    files,
    laterParentFiles: later,
    mergedFiles: merged,
  };
  return details;
}

const first = "1111111111aaaa";
const second = "2222222222bbbb";
const merge = commit(
  [first, second],
  [file("a.txt"), file("c.txt")],
  [[file("a.txt"), file("b.txt")]],
  [file("a.txt")],
);

describe("commitFileRows", () => {
  it("lists a plain commit's files against its parent", () => {
    const rows = commitFileRows(commit([first], [file("a.txt"), file("b.txt")]), "merged");
    expect(rows.map((row) => row.key)).toEqual(["a.txt", "b.txt"]);
  });

  it("lists a merge's files changed on both sides", () => {
    const rows = commitFileRows(merge, "merged");
    expect(rows).toEqual([{ kind: "file", key: "a.txt", file: file("a.txt"), parentIndex: 0 }]);
  });

  it("groups a merge's changes under each parent", () => {
    const rows = commitFileRows(merge, "parents");
    expect(rows.map((row) => (row.kind === "heading" ? `# ${row.title} (${row.count})` : row.key))).toEqual([
      "# Changes to parent 1: 11111111 (2)",
      "a.txt",
      "c.txt",
      "# Changes to parent 2: 22222222 (2)",
      fileRowKey(1, "a.txt"),
      fileRowKey(1, "b.txt"),
    ]);
  });

  it("keeps the same file apart per parent", () => {
    expect(fileRowKey(0, "a.txt")).toBe("a.txt");
    expect(fileRowKey(1, "a.txt")).not.toBe("a.txt");
    const row = fileRowAt(commitFileRows(merge, "parents"), fileRowKey(1, "a.txt"));
    expect(row?.parentIndex).toBe(1);
  });
});

describe("pickFileRow", () => {
  const rows = commitFileRows(merge, "parents");

  it("prefers the asked file, by new or old name", () => {
    expect(pickFileRow(rows, "c.txt", "b.txt")).toBe(fileRowKey(1, "b.txt"));
    const renamed = commitFileRows(commit([first], [file("new.txt", "old.txt")]), "merged");
    expect(pickFileRow(renamed, null, "old.txt")).toBe("new.txt");
  });

  it("keeps the current file, else takes the first", () => {
    expect(pickFileRow(rows, "c.txt", null)).toBe("c.txt");
    expect(pickFileRow(rows, "gone.txt", null)).toBe("a.txt");
    expect(pickFileRow(rows, "parent\u00000", null)).toBe("a.txt");
    expect(pickFileRow([], "a.txt", null)).toBeNull();
  });
});

describe("labels", () => {
  it("names parents and captions the list", () => {
    expect(parentLabel(merge, 1)).toBe("Parent 2");
    expect(parentLabel(commit([first], []), 0)).toBe("Parent");
    expect(parentLabel(null, 0)).toBe("Parent");
    expect(filesCaption(merge, "merged")).toBe("Changed on both sides");
    expect(filesCaption(commit([first, second, "3333"], [], [[], []]), "merged")).toBe("Changed on every side");
    expect(filesCaption(merge, "parents")).toBe("Changes to parents");
    expect(filesCaption(commit([first], [file("a.txt")]), "merged")).toBe("1 changed file");
    expect(filesCaption(commit([], [file("a.txt"), file("b.txt")]), "merged")).toBe("2 changed files");
  });

  it("reads each parent's files", () => {
    expect(parentFiles(merge, 0)).toBe(merge.files);
    expect(parentFiles(merge, 1).map((changed) => changed.path)).toEqual(["a.txt", "b.txt"]);
    expect(parentFiles(merge, 5)).toEqual([]);
  });
});
