import { describe, expect, it } from "vitest";
import type { RepoInfo } from "$lib/types";
import {
  baseName,
  folderFor,
  joinPath,
  locate,
  locateAbsolute,
  normalizePath,
  parentOf,
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
