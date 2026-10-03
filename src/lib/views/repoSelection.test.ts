import { describe, expect, it } from "vitest";
import { commitTabPath } from "$lib/stores/commitTabs";
import { terminalTabPath } from "$lib/terminal/terminalTabs";
import type { RepoInfo, RepoStatus } from "$lib/types";
import { AUTO_PICK, repoPickItems, type ScreenInput, screenRepo } from "./repoSelection";

const repos: RepoInfo[] = [
  { root: "/work/web", name: "web", relativePath: "web" },
  { root: "/work/web/vendor/lib", name: "lib", relativePath: "web/vendor/lib" },
  { root: "/work/api", name: "api", relativePath: "api" },
];

function input(overrides: Partial<ScreenInput>): ScreenInput {
  return {
    shownView: "file",
    openFilePath: null,
    selectedRepoRoot: null,
    repos,
    terminalCwd: () => null,
    ...overrides,
  };
}

function status(branch: string | null, shortId: string | null = null): RepoStatus {
  return {
    head: { branch, shortId, unborn: false, upstream: null, ahead: 0, behind: 0 },
    op: { kind: "none", description: "", oursLabel: "", theirsLabel: "" },
    files: [],
  };
}

describe("screenRepo", () => {
  it("follows a file tab to the deepest repository", () => {
    expect(screenRepo(input({ openFilePath: "/work/web/src/app.ts" }))).toEqual({ kind: "repo", repoRoot: "/work/web" });
    expect(screenRepo(input({ openFilePath: "/work/web/vendor/lib/a.c" }))).toEqual({
      kind: "repo",
      repoRoot: "/work/web/vendor/lib",
    });
  });

  it("says outside for a file in no repository", () => {
    expect(screenRepo(input({ openFilePath: "/work/notes.md" }))).toEqual({ kind: "outside" });
  });

  it("follows a commit tab to its repository, unless it was closed", () => {
    expect(screenRepo(input({ openFilePath: commitTabPath("/work/api", "abc1234") }))).toEqual({
      kind: "repo",
      repoRoot: "/work/api",
    });
    expect(screenRepo(input({ openFilePath: commitTabPath("/gone", "abc1234") }))).toEqual({ kind: "active" });
  });

  it("follows a terminal tab to the repository of its folder", () => {
    const openFilePath = terminalTabPath(3);
    const cwd = (terminalKey: number) => (terminalKey === 3 ? "/work/api/src" : null);
    expect(screenRepo(input({ openFilePath, terminalCwd: cwd }))).toEqual({ kind: "repo", repoRoot: "/work/api" });
    expect(screenRepo(input({ openFilePath }))).toEqual({ kind: "active" });
    expect(screenRepo(input({ openFilePath, terminalCwd: () => "/tmp" }))).toEqual({ kind: "active" });
  });

  it("follows the selected change in a diff", () => {
    expect(screenRepo(input({ shownView: "diff", selectedRepoRoot: "/work/api" }))).toEqual({
      kind: "repo",
      repoRoot: "/work/api",
    });
    expect(screenRepo(input({ shownView: "diff" }))).toEqual({ kind: "active" });
  });

  it("leaves the Log and an empty editor to the active repository", () => {
    expect(screenRepo(input({ shownView: "log", openFilePath: "/work/web/a.ts" }))).toEqual({ kind: "active" });
    expect(screenRepo(input({ shownView: "none" }))).toEqual({ kind: "active" });
    expect(screenRepo(input({ shownView: "file", openFilePath: null }))).toEqual({ kind: "active" });
  });
});

describe("repoPickItems", () => {
  const statuses = { "/work/web": status("main"), "/work/api": status(null, "1a2b3c4") };

  it("lists Auto first, then each repository with its branch and folder", () => {
    const items = repoPickItems(repos, statuses, true, "/work/web");
    expect(items.map((item) => item.value)).toEqual([AUTO_PICK, "/work/web", "/work/web/vendor/lib", "/work/api"]);
    expect(items[0]).toMatchObject({ label: "Auto", description: "selected  follows the open tab" });
    expect(items[1]).toMatchObject({ label: "web", description: "main", group: "Repositories" });
    expect(items[2]).toMatchObject({ label: "lib", description: "web/vendor/lib" });
    expect(items[3]).toMatchObject({ label: "api", description: "detached 1a2b3c4" });
  });

  it("marks the chosen repository when Auto is off", () => {
    const items = repoPickItems(repos, statuses, false, "/work/api");
    expect(items[0].description).toBe("follows the open tab");
    expect(items[1].description).toBe("main");
    expect(items[3].description).toBe("selected  detached 1a2b3c4");
  });
});
