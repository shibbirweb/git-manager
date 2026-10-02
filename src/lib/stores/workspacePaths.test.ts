import { describe, expect, it } from "vitest";
import type { RepoInfo } from "$lib/types";
import {
  baseName,
  folderFor,
  joinPath,
  locate,
  locateAbsolute,
  movedPath,
  normalizePath,
  parentOf,
  pathsUnder,
  repoForPath,
  toWorkspacePath,
} from "./workspacePaths";

const repo = (root: string, relativePath = ""): RepoInfo => ({ root, name: root.split("/").pop() ?? root, relativePath });

const repos = [repo("/work", ""), repo("/work/apps/web", "apps/web"), repo("/work/apps/webhooks", "apps/webhooks")];

describe("workspace paths", () => {
  it("normalizes dot segments without leaving the root", () => {
    expect(normalizePath("/work/docs/../img/./a.png")).toBe("/work/img/a.png");
    expect(normalizePath("/work//docs/")).toBe("/work/docs");
    expect(normalizePath("/../../etc")).toBe("/etc");
    expect(normalizePath("/")).toBe("/");
  });

  it("joins without doubling slashes", () => {
    expect(joinPath("/work", "a/b")).toBe("/work/a/b");
    expect(joinPath("/", "a")).toBe("/a");
    expect(joinPath("/work", "")).toBe("/work");
  });

  it("picks the deepest repository and respects folder boundaries", () => {
    expect(repoForPath(repos, "/work/apps/web/src/a.ts")?.root).toBe("/work/apps/web");
    expect(repoForPath(repos, "/work/apps/webhooks/x.ts")?.root).toBe("/work/apps/webhooks");
    expect(repoForPath(repos, "/work/README.md")?.root).toBe("/work");
    expect(repoForPath(repos, "/elsewhere/file")).toBeNull();
  });

  it("maps workspace paths into repositories", () => {
    expect(locate("/work", repos, "apps/web/src/a.ts")).toEqual({ repo: repos[1], repoPath: "src/a.ts" });
    expect(locate("/work", repos, "README.md")?.repoPath).toBe("README.md");
    expect(locate("/plain", [], "notes.txt")).toBeNull();
  });

  it("maps repository paths back, including an enclosing repository", () => {
    expect(toWorkspacePath("/work", "/work/apps/web", "src/a.ts")).toBe("apps/web/src/a.ts");
    // Workspace opened on a subfolder of a bigger repository.
    expect(toWorkspacePath("/big/services", "/big", "services/api/main.go")).toBe("api/main.go");
    expect(toWorkspacePath("/big/services", "/big", "docs/readme.md")).toBeNull();
  });

  it("finds the workspace folder of a file, preferring the deepest", () => {
    const folders = [
      { root: "/work", name: "work" },
      { root: "/work/apps/api", name: "api" },
      { root: "/other", name: "other" },
    ];
    expect(folderFor(folders, "/work/apps/api/main.go")?.name).toBe("api");
    expect(folderFor(folders, "/work/README.md")?.name).toBe("work");
    expect(folderFor(folders, "/other/x")?.name).toBe("other");
    expect(folderFor(folders, "/elsewhere/x")).toBeNull();
  });

  it("locates absolute paths and splits them", () => {
    expect(locateAbsolute(repos, "/work/apps/web/src/a.ts")).toEqual({ repo: repos[1], repoPath: "src/a.ts" });
    expect(locateAbsolute(repos, "/nowhere/a.ts")).toBeNull();
    expect(parentOf("/work/apps/web")).toBe("/work/apps");
    expect(parentOf("/work")).toBe("/");
    expect(baseName("/work/apps/web")).toBe("web");
  });
});

describe("movedPath", () => {
  const moves = [
    { from: "/work/app/src/cart.ts", to: "/work/app/src/basket.ts" },
    { from: "/work/app/lib", to: "/work/app/src/lib" },
  ];

  it("follows a renamed file and everything inside a moved folder", () => {
    expect(movedPath("/work/app/src/cart.ts", moves)).toBe("/work/app/src/basket.ts");
    expect(movedPath("/work/app/lib", moves)).toBe("/work/app/src/lib");
    expect(movedPath("/work/app/lib/deep/a.ts", moves)).toBe("/work/app/src/lib/deep/a.ts");
  });

  it("leaves other paths alone, also ones that only share a prefix", () => {
    expect(movedPath("/work/app/library/a.ts", moves)).toBe("/work/app/library/a.ts");
    expect(movedPath("/work/app/src/cart.tsx", moves)).toBe("/work/app/src/cart.tsx");
    expect(movedPath("/work/app/README.md", [])).toBe("/work/app/README.md");
  });
});

describe("pathsUnder", () => {
  it("keeps the entries themselves and what lies inside them", () => {
    const paths = ["/w/a/x.ts", "/w/a", "/w/ab/y.ts", "/w/b.ts"];
    expect(pathsUnder(paths, ["/w/a"])).toEqual(["/w/a/x.ts", "/w/a"]);
    expect(pathsUnder(paths, ["/w/b.ts", "/w/ab"])).toEqual(["/w/ab/y.ts", "/w/b.ts"]);
    expect(pathsUnder(paths, [])).toEqual([]);
  });
});
