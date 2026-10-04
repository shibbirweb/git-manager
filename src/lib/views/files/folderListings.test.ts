import { describe, expect, it } from "vitest";
import type { FolderListing } from "$lib/types";
import { applyAnswers, type FolderAnswer, groupByFolder, knownStamps, type LoadedFolders, type TreeEntry } from "./folderListings";

function listing(dirPath: string, names: string[], overrides: Partial<FolderListing> = {}): FolderListing {
  return {
    dirPath,
    stamp: `stamp-${names.join(",")}`,
    unchanged: false,
    entries: names.map((name) => ({ name, isDir: !name.includes("."), ignored: false, isRepo: false })),
    truncated: false,
    error: null,
    ...overrides,
  };
}

function entry(path: string, isDir = false): TreeEntry {
  return { name: path.slice(path.lastIndexOf("/") + 1), path, isDir, ignored: false, isRepo: false, deleted: false, isFolderRoot: false };
}

function empty(): LoadedFolders {
  return { children: new Map(), expanded: new Set(["/w", "/w/src"]), truncated: new Set(), rootErrors: new Map() };
}

const always = () => true;

describe("groupByFolder", () => {
  it("groups folders by their workspace folder, once each, and drops the rest", () => {
    const folderOf = (dirPath: string) => (dirPath.startsWith("/w") ? "/w" : dirPath.startsWith("/v") ? "/v" : null);
    const groups = groupByFolder(["/w", "/w/src", "/v/a", "/w/src", "/elsewhere"], folderOf);
    expect([...groups]).toEqual([
      ["/w", ["/w", "/w/src"]],
      ["/v", ["/v/a"]],
    ]);
  });
});

describe("knownStamps", () => {
  it("sends stamps only for folders still loaded, relative to the workspace folder", () => {
    const stamps = new Map([
      ["/w", "s0"],
      ["/w/src", "s1"],
      ["/w/gone", "s2"],
    ]);
    const children = new Map([
      ["/w", []],
      ["/w/src", []],
    ]);
    expect(knownStamps("/w", ["/w", "/w/src", "/w/gone", "/w/new"], stamps, children)).toEqual({ "": "s0", src: "s1" });
  });
});

describe("applyAnswers", () => {
  it("fills folders with absolute paths and remembers their stamps", () => {
    const stamps = new Map<string, string>();
    const answers: FolderAnswer[] = [
      { root: "/w", dirPaths: ["/w", "/w/src"], listings: [listing("", ["src", "a.ts"]), listing("src", ["b.ts"], { truncated: true })], error: null },
    ];
    const next = applyAnswers(empty(), answers, stamps, always);
    expect(next.children.get("/w")).toEqual([entry("/w/src", true), entry("/w/a.ts")]);
    expect(next.children.get("/w/src")).toEqual([entry("/w/src/b.ts")]);
    expect([...next.truncated]).toEqual(["/w/src"]);
    expect(stamps.get("/w")).toBe("stamp-src,a.ts");
  });

  it("keeps every collection as it was when nothing changed", () => {
    const stamps = new Map<string, string>();
    const first = applyAnswers(empty(), [{ root: "/w", dirPaths: ["/w"], listings: [listing("", ["a.ts"])], error: null }], stamps, always);
    const unchanged = applyAnswers(
      first,
      [{ root: "/w", dirPaths: ["/w"], listings: [listing("", [], { unchanged: true, stamp: "stamp-a.ts" })], error: null }],
      stamps,
      always,
    );
    expect(unchanged.children).toBe(first.children);
    expect(unchanged.expanded).toBe(first.expanded);
    expect(unchanged.truncated).toBe(first.truncated);
    expect(unchanged.rootErrors).toBe(first.rootErrors);
    // A fresh listing with the same entries keeps the old array, so rows do not re-render.
    const same = applyAnswers(first, [{ root: "/w", dirPaths: ["/w"], listings: [listing("", ["a.ts"])], error: null }], stamps, always);
    expect(same.children).toBe(first.children);
  });

  it("forgets folders that disappeared and reports a failing workspace folder", () => {
    const stamps = new Map<string, string>();
    const loaded = applyAnswers(
      empty(),
      [{ root: "/w", dirPaths: ["/w", "/w/src"], listings: [listing("", ["src"]), listing("src", ["b.ts"])], error: null }],
      stamps,
      always,
    );
    const gone = applyAnswers(
      loaded,
      [{ root: "/w", dirPaths: ["/w/src"], listings: [listing("src", [], { error: "No such file" })], error: null }],
      stamps,
      always,
    );
    expect(gone.children.has("/w/src")).toBe(false);
    expect(gone.expanded.has("/w/src")).toBe(false);
    expect(stamps.has("/w/src")).toBe(false);

    const failed = applyAnswers(gone, [{ root: "/w", dirPaths: ["/w"], listings: null, error: "Folder does not exist" }], stamps, always);
    expect(failed.rootErrors.get("/w")).toBe("Folder does not exist");
    const back = applyAnswers(failed, [{ root: "/w", dirPaths: ["/w"], listings: [listing("", ["src"])], error: null }], stamps, always);
    expect(back.rootErrors.has("/w")).toBe(false);
  });

  it("skips answers a newer request replaced", () => {
    const stamps = new Map<string, string>();
    const next = applyAnswers(
      empty(),
      [{ root: "/w", dirPaths: ["/w", "/w/src"], listings: [listing("", ["old.ts"]), listing("src", ["b.ts"])], error: null }],
      stamps,
      (dirPath) => dirPath !== "/w",
    );
    expect(next.children.has("/w")).toBe(false);
    expect(next.children.get("/w/src")).toEqual([entry("/w/src/b.ts")]);
  });
});
