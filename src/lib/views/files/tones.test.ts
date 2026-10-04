import { describe, expect, it } from "vitest";
import type { FileStatus } from "$lib/types";
import { joinPath } from "$lib/stores/workspacePaths";
import { deletedByFolder, type FileTone, marksByPath, repoTones, tonesByPath, workspaceTones } from "./tones";

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

// The first version of tonesByPath, without the early exit: the new one must match it.
const rankOf: Record<FileTone, number> = { deleted: 1, added: 2, modified: 3, conflict: 4 };
function tonesReference(files: FileStatus[]): Map<string, FileTone> {
  const tones = new Map<string, FileTone>();
  const raise = (path: string, tone: FileTone) => {
    const current = tones.get(path);
    if (!current || rankOf[tone] > rankOf[current]) {
      tones.set(path, tone);
    }
  };
  for (const entry of files) {
    const tone = tonesByPath([entry]).get(entry.path) as FileTone;
    raise(entry.path, tone);
    let slash = entry.path.lastIndexOf("/");
    while (slash > 0) {
      raise(entry.path.slice(0, slash), tone);
      slash = entry.path.lastIndexOf("/", slash - 1);
    }
  }
  return tones;
}

function random(seed: number): (below: number) => number {
  let state = seed;
  return (below) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % below;
  };
}

function randomFiles(next: (below: number) => number, count: number): FileStatus[] {
  const parts = ["a", "b", "src", "lib", "x.ts", "y.md"];
  const kinds = [null, "modified", "added", "deleted", "untracked", "renamed"] as const;
  return Array.from({ length: count }, () => {
    const depth = 1 + next(4);
    const path = Array.from({ length: depth }, () => parts[next(parts.length)]).join("/");
    return file(next(15) === 0 ? `${path}/` : path, {
      staged: kinds[next(kinds.length)] === "untracked" ? null : (kinds[next(kinds.length - 1)] as FileStatus["staged"]),
      unstaged: kinds[next(kinds.length)] as FileStatus["unstaged"],
      conflicted: next(20) === 0,
      origPath: next(10) === 0 ? "old/name.ts" : null,
    });
  });
}

describe("tonesByPath on random files", () => {
  it("gives the same tones as the first version", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const files = randomFiles(random(seed), 1 + (seed % 60));
      expect(tonesByPath(files), `seed ${seed}`).toEqual(tonesReference(files));
    }
  });
});

describe("workspaceTones", () => {
  it("answers like the merged maps of every repository's files", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed);
      const roots = ["/w", "/w/a", "/w/b/lib", "/other"].slice(0, 1 + (seed % 4));
      const statuses = roots.map(() => ({ files: randomFiles(next, next(30)) }));
      // The old way: every file with an absolute path, in repository order.
      const all = statuses.flatMap((status, index) =>
        status.files
          .filter((entry) => !entry.path.endsWith("/"))
          .map((entry) => ({ ...entry, path: joinPath(roots[index], entry.path), origPath: entry.origPath ? joinPath(roots[index], entry.origPath) : null })),
      );
      const tones = tonesByPath(all);
      const marks = marksByPath(all);
      const deleted = deletedByFolder(all);
      const lookup = workspaceTones(statuses.map((status, index) => repoTones(status, roots[index])));
      const paths = new Set([...tones.keys(), ...marks.keys(), ...deleted.keys(), "/w", "/nothing"]);
      for (const path of paths) {
        expect(lookup.tone(path), `seed ${seed} ${path}`).toBe(tones.get(path));
        expect(lookup.mark(path), `seed ${seed} ${path}`).toEqual(marks.get(path));
        expect(lookup.deletedIn(path), `seed ${seed} ${path}`).toEqual(deleted.get(path) ?? []);
      }
    }
  });

  it("works a status out once while the object stays the same", () => {
    const status = { files: [file("src/a.ts")] };
    const first = repoTones(status, "/w");
    expect(repoTones(status, "/w")).toBe(first);
    expect(repoTones({ files: [file("src/a.ts")] }, "/w")).not.toBe(first);
    expect(repoTones(status, "/other").tones.get("/other/src")).toBe("modified");
  });
});
