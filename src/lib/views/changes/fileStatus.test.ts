import { describe, expect, it } from "vitest";
import type { FileStatus } from "$lib/types";
import { rowElementId, rowKind, stagingNote } from "./fileStatus";

describe("rowElementId", () => {
  it("makes one valid id per repository, area and path", () => {
    const id = rowElementId({ repoRoot: "/work/my repo", path: "src/a b.ts", area: "unstaged" });
    expect(id).not.toMatch(/\s/);
    expect(id).not.toBe(rowElementId({ repoRoot: "/work/my repo", path: "src/a b.ts", area: "staged" }));
    expect(id).not.toBe(rowElementId({ repoRoot: "/work/other", path: "src/a b.ts", area: "unstaged" }));
    expect(id).toBe(rowElementId({ repoRoot: "/work/my repo", path: "src/a b.ts", area: "unstaged" }));
  });
});

function status(path: string, extra: Partial<FileStatus> = {}): FileStatus {
  return { path, staged: null, unstaged: null, conflicted: false, ...extra } as FileStatus;
}

describe("rowKind and stagingNote", () => {
  it("name a changed file's change and where it sits", () => {
    expect(rowKind(status("n", { unstaged: "untracked" }))).toBe("untracked");
    expect(rowKind(status("s", { staged: "added", unstaged: "modified" }))).toBe("added");
    expect(rowKind(status("d", { unstaged: "deleted" }))).toBe("deleted");
    expect(rowKind(status("m", { unstaged: "modified" }))).toBe("modified");
    expect(stagingNote(status("n", { unstaged: "untracked" }))).toBe("new");
    expect(stagingNote(status("s", { staged: "added", unstaged: "modified" }))).toBe("staged and unstaged");
    expect(stagingNote(status("t", { staged: "modified" }))).toBe("staged");
    expect(stagingNote(status("m", { unstaged: "modified" }))).toBe("");
  });
});
