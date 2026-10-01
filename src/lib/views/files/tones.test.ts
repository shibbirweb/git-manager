import { describe, expect, it } from "vitest";
import type { FileStatus } from "$lib/types";
import { deletedByFolder, marksByPath, tonesByPath } from "./tones";

function file(path: string, overrides: Partial<FileStatus> = {}): FileStatus {
  return { path, origPath: null, staged: null, unstaged: "modified", conflicted: false, ...overrides };
}

describe("tonesByPath", () => {
  it("marks files and every parent folder", () => {
    const tones = tonesByPath([file("src/lib/a.ts")]);
    expect(tones.get("src/lib/a.ts")).toBe("modified");
    expect(tones.get("src/lib")).toBe("modified");
    expect(tones.get("src")).toBe("modified");
  });

  it("gives folders the strongest tone of their contents", () => {
    const tones = tonesByPath([
      file("src/new.ts", { unstaged: "untracked" }),
      file("src/x.ts", { unstaged: null, conflicted: true }),
      file("docs/a.md", { unstaged: "untracked" }),
    ]);
    expect(tones.get("src/new.ts")).toBe("added");
    expect(tones.get("src")).toBe("conflict");
    expect(tones.get("docs")).toBe("added");
  });

  it("treats a staged new file as added", () => {
    expect(tonesByPath([file("a.ts", { staged: "added", unstaged: null })]).get("a.ts")).toBe("added");
  });
});

describe("marksByPath", () => {
  it("uses VS Code style letters", () => {
    const marks = marksByPath([
      file("untracked.ts", { unstaged: "untracked" }),
      file("added.ts", { staged: "added", unstaged: null }),
      file("added-then-edited.ts", { staged: "added", unstaged: "modified" }),
      file("modified.ts"),
      file("gone.ts", { unstaged: "deleted" }),
      file("staged-delete.ts", { staged: "deleted", unstaged: null }),
      file("moved.ts", { staged: "renamed", unstaged: null, origPath: "old.ts" }),
      file("both.ts", { unstaged: null, conflicted: true }),
    ]);
    const letters = Object.fromEntries([...marks].map(([path, mark]) => [path, mark.letter]));
    expect(letters).toEqual({
      "untracked.ts": "U",
      "added.ts": "A",
      "added-then-edited.ts": "A",
      "modified.ts": "M",
      "gone.ts": "D",
      "staged-delete.ts": "D",
      "moved.ts": "R",
      "both.ts": "C",
    });
    expect(marks.get("moved.ts")?.title).toBe("Renamed (staged), from old.ts");
    expect(marks.get("added-then-edited.ts")?.title).toBe("Added (staged), modified (not staged)");
    expect(marks.get("gone.ts")?.tone).toBe("deleted");
  });
});

describe("deletedByFolder", () => {
  it("groups deleted files under their folder", () => {
    const folders = deletedByFolder([
      file("CHANGELOG.md", { unstaged: "deleted" }),
      file("docs/old.md", { staged: "deleted", unstaged: null }),
      file("docs/kept.md"),
    ]);
    expect(folders.get("")).toEqual(["CHANGELOG.md"]);
    expect(folders.get("docs")).toEqual(["docs/old.md"]);
  });
});
